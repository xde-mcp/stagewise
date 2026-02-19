import { DisposableService } from '../disposable';
import type { Logger } from '../logger';
import type { WindowLayoutService } from '../window-layout';
import { utilityProcess } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMainIPC, type WorkerToMainMessage } from './ipc';

/**
 * Callback type for writing files from the sandbox to the user's workspace.
 * Provided by ToolboxService to handle diff-history tracking.
 * Content is always provided as a Buffer (already decoded from IPC transport).
 */
export type SandboxFileWriter = (
  agentId: string,
  relativePath: string,
  content: Buffer,
  toolCallId: string,
) => Promise<{ success: true; bytesWritten: number }>;

/**
 * Callback type for resolving attachment data from user messages.
 * Provided by ToolboxService to look up attachments by ID from agent history.
 */
export type AttachmentResolver = (
  agentId: string,
  attachmentId: string,
) => Promise<{
  id: string;
  fileName: string;
  mediaType: string;
  content: Buffer;
}>;

/**
 * Resolve the path to the compiled sandbox worker script.
 * The worker is built as a separate CJS entry by Vite (see vite.sandbox-worker.config.ts)
 * and lives alongside main.js in .vite/build/.
 *
 * utilityProcess.fork() can read from ASAR archives, so this path works
 * in both dev mode and packaged production builds.
 */
const SANDBOX_WORKER_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'sandbox-worker.cjs',
);

interface WorkerInfo {
  process: Electron.UtilityProcess;
  ipc: ReturnType<typeof createMainIPC>;
  agentIds: Set<string>;
  load: number; // number of agents on this worker
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeout: NodeJS.Timeout;
  agentId: string;
}

export class SandboxService extends DisposableService {
  private readonly windowLayoutService: WindowLayoutService;
  private readonly logger: Logger;
  private readonly fileWriter?: SandboxFileWriter;
  private readonly attachmentResolver?: AttachmentResolver;
  private workers: WorkerInfo[] = [];
  private agentToWorker = new Map<string, WorkerInfo>();
  private pendingRequests = new Map<string, PendingRequest>();
  private agentToolCallIds = new Map<string, string>();
  private reqId = 0;

  constructor(
    windowLayoutService: WindowLayoutService,
    logger: Logger,
    fileWriter?: SandboxFileWriter,
    attachmentResolver?: AttachmentResolver,
    private poolSize = 4,
  ) {
    super();
    this.windowLayoutService = windowLayoutService;
    this.logger = logger;
    this.fileWriter = fileWriter;
    this.attachmentResolver = attachmentResolver;
  }

  public static async create(
    windowLayoutService: WindowLayoutService,
    logger: Logger,
    fileWriter?: SandboxFileWriter,
    attachmentResolver?: AttachmentResolver,
  ): Promise<SandboxService> {
    const instance = new SandboxService(
      windowLayoutService,
      logger,
      fileWriter,
      attachmentResolver,
    );
    await instance.initialize();
    return instance;
  }

  /**
   * Set the current tool call ID for an agent.
   * Called by execute-sandbox-js tool before execution.
   */
  setAgentToolCallId(agentId: string, toolCallId: string) {
    this.agentToolCallIds.set(agentId, toolCallId);
  }

  /**
   * Clear the current tool call ID for an agent.
   * Called by execute-sandbox-js tool after execution completes.
   */
  clearAgentToolCallId(agentId: string) {
    this.agentToolCallIds.delete(agentId);
  }

  async initialize() {
    for (let i = 0; i < this.poolSize; i++)
      this.workers.push(this.spawnWorker());
  }

  private spawnWorker(): WorkerInfo {
    // --max-old-space-size is a V8 flag handled by execArgv.
    // --experimental-vm-modules is a Node.js flag that must be passed via
    // NODE_OPTIONS because Electron utility processes don't forward Node
    // flags from execArgv to the embedded Node.js runtime.
    const nodeOptions = [process.env.NODE_OPTIONS, '--experimental-vm-modules']
      .filter(Boolean)
      .join(' ');

    const child = utilityProcess.fork(SANDBOX_WORKER_PATH, [], {
      execArgv: ['--max-old-space-size=256'],
      env: { ...process.env, NODE_OPTIONS: nodeOptions },
      serviceName: 'stagewise-sandbox',
    });

    const ipc = createMainIPC(child);
    const info: WorkerInfo = {
      process: child,
      agentIds: new Set(),
      load: 0,
      ipc,
    };

    ipc.onMessage((msg: any) => this.handleWorkerMessage(info, msg));
    child.on('exit', (code) => this.handleWorkerCrash(info, code));

    return info;
  }

  createAgent(agentId: string) {
    const worker = this.leastLoadedWorker();
    worker.agentIds.add(agentId);
    worker.load++;
    this.agentToWorker.set(agentId, worker);

    this.safeSend(worker, { type: 'create-context', agentId });
  }

  destroyAgent(agentId: string) {
    const worker = this.agentToWorker.get(agentId);
    if (!worker) return;

    this.safeSend(worker, { type: 'destroy-context', agentId });
    worker.agentIds.delete(agentId);
    worker.load--;
    this.agentToWorker.delete(agentId);
    this.agentToolCallIds.delete(agentId);
  }

  async execute(
    agentId: string,
    code: string,
    timeoutMs = 120_000, // 2 minutes
  ): Promise<{
    value: any;
    outputs: string[];
    customFileAttachments: Array<{
      id: string;
      mediaType: string;
      fileName?: string;
      url: string;
    }>;
  }> {
    // Lazily create agent context on first execution
    if (!this.agentToWorker.has(agentId)) this.createAgent(agentId);

    const worker = this.agentToWorker.get(agentId);
    if (!worker) throw new Error(`Unknown agent: ${agentId}`);

    const id = `${this.reqId++}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Execution timeout'));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout, agentId });
      if (!this.safeSend(worker, { type: 'execute', id, agentId, code })) {
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(new Error('Worker process is not available'));
      }
    });
  }

  private async handleWorkerMessage(
    worker: WorkerInfo,
    msg: WorkerToMainMessage,
  ) {
    switch (msg.type) {
      case 'cdp': {
        // Worker sandbox wants a CDP call — forward to the real debugger
        try {
          const result = await this.windowLayoutService.sendCDP(
            msg.tabId,
            msg.method,
            msg.params,
          );
          this.safeSend(worker, { type: 'cdp-result', id: msg.id, result });
        } catch (err) {
          this.safeSend(worker, {
            type: 'cdp-result',
            id: msg.id,
            error: String(err),
          });
        }
        break;
      }
      case 'result': {
        const pending = this.pendingRequests.get(msg.id);
        if (!pending) return;
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          const errorMessage = msg.errorStack
            ? `${msg.error}\n\n${msg.errorStack}`
            : msg.error;
          pending.reject(new Error(errorMessage));
        } else {
          pending.resolve({
            value: msg.value,
            outputs: msg.outputs ?? [],
            customFileAttachments: msg.customFileAttachments ?? [],
          });
        }
        break;
      }
      case 'write-file': {
        // Worker sandbox wants to write a file — delegate to fileWriter callback
        const toolCallId = this.agentToolCallIds.get(msg.agentId);
        if (!this.fileWriter) {
          this.safeSend(worker, {
            type: 'write-file-result',
            id: msg.id,
            error: 'File writing is not configured',
          });
          return;
        }
        if (!toolCallId) {
          this.safeSend(worker, {
            type: 'write-file-result',
            id: msg.id,
            error: 'No active tool call context for file write',
          });
          return;
        }
        try {
          // Decode content from IPC transport format back to Buffer
          const contentBuffer = msg.isBase64
            ? Buffer.from(msg.content, 'base64')
            : Buffer.from(msg.content, 'utf-8');

          const result = await this.fileWriter(
            msg.agentId,
            msg.relativePath,
            contentBuffer,
            toolCallId,
          );
          this.safeSend(worker, {
            type: 'write-file-result',
            id: msg.id,
            result,
          });
        } catch (err) {
          this.safeSend(worker, {
            type: 'write-file-result',
            id: msg.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }
      case 'get-attachment': {
        // Worker sandbox wants to retrieve an attachment — delegate to resolver
        if (!this.attachmentResolver) {
          this.safeSend(worker, {
            type: 'get-attachment-result',
            id: msg.id,
            error: 'Attachment resolver is not configured',
          });
          return;
        }
        try {
          const result = await this.attachmentResolver(
            msg.agentId,
            msg.attachmentId,
          );
          // Encode content as base64 for IPC transport
          this.safeSend(worker, {
            type: 'get-attachment-result',
            id: msg.id,
            result: {
              id: result.id,
              fileName: result.fileName,
              mediaType: result.mediaType,
              content: result.content.toString('base64'),
            },
          });
        } catch (err) {
          this.safeSend(worker, {
            type: 'get-attachment-result',
            id: msg.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }
    }
  }

  private handleWorkerCrash(crashed: WorkerInfo, code: number | null) {
    this.logger.warn(
      `Worker died (code ${code}), recovering ${crashed.agentIds.size} agents`,
    );

    this.workers = this.workers.filter((w) => w !== crashed);

    // Only reject pending requests that belong to agents on the crashed worker
    for (const [id, pending] of this.pendingRequests) {
      if (crashed.agentIds.has(pending.agentId)) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Worker crashed'));
        this.pendingRequests.delete(id);
      }
    }

    const replacement = this.spawnWorker();
    this.workers.push(replacement);

    for (const agentId of crashed.agentIds) {
      replacement.agentIds.add(agentId);
      replacement.load++;
      this.agentToWorker.set(agentId, replacement);
      this.safeSend(replacement, { type: 'create-context', agentId });
    }
  }

  /**
   * Safely send an IPC message to a worker, catching errors
   * if the child process has already exited.
   */
  private safeSend(worker: WorkerInfo, msg: Record<string, unknown>): boolean {
    try {
      worker.process.postMessage(msg);
      return true;
    } catch (err) {
      this.logger.warn(
        `Failed to send message to worker (pid ${worker.process.pid}): ${err}`,
      );
      return false;
    }
  }

  private leastLoadedWorker(): WorkerInfo {
    return this.workers.reduce((a, b) => (a.load <= b.load ? a : b));
  }

  protected onTeardown(): Promise<void> | void {
    for (const worker of this.workers) worker.process.kill();

    this.workers = [];
    this.agentToWorker.clear();
    this.pendingRequests.clear();
    this.agentToolCallIds.clear();
  }
}
