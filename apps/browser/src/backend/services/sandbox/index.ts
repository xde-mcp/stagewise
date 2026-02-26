import { DisposableService } from '../disposable';
import type { Logger } from '../logger';
import type { WindowLayoutService } from '../window-layout';
import { utilityProcess } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createMainIPC,
  type MountDescriptor,
  type WorkerToMainMessage,
} from './ipc';

/**
 * Callback type for handling file diff notifications from the sandbox worker.
 * The worker captures before/after state in-process and sends it via IPC.
 * The main process registers the edit with diff-history and syncs with LSP.
 */
export type FileDiffHandler = (
  agentId: string,
  absolutePath: string,
  before: string | null,
  after: string | null,
  isExternal: boolean,
  bytesWritten: number,
  toolCallId: string,
) => Promise<void>;

/**
 * Callback that resolves the current mount configuration for an agent.
 * Called by SandboxService when lazily creating an agent context so the
 * worker receives mounts immediately, even if the workspace was mounted
 * before the agent's first sandbox execution.
 */
export type MountResolver = (agentId: string) => MountDescriptor[];

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
  private readonly fileDiffHandler?: FileDiffHandler;
  private readonly mountResolver?: MountResolver;
  private workers: WorkerInfo[] = [];
  private agentToWorker = new Map<string, WorkerInfo>();
  private pendingRequests = new Map<string, PendingRequest>();
  private agentToolCallIds = new Map<string, string>();
  private fileWriteCountPerExecution = new Map<string, number>();
  private sandboxSessionIds = new Map<string, string>();
  private reqId = 0;

  constructor(
    windowLayoutService: WindowLayoutService,
    logger: Logger,
    fileDiffHandler?: FileDiffHandler,
    mountResolver?: MountResolver,
    private poolSize = 4,
  ) {
    super();
    this.windowLayoutService = windowLayoutService;
    this.logger = logger;
    this.fileDiffHandler = fileDiffHandler;
    this.mountResolver = mountResolver;
  }

  public static async create(
    windowLayoutService: WindowLayoutService,
    logger: Logger,
    fileDiffHandler?: FileDiffHandler,
    mountResolver?: MountResolver,
  ): Promise<SandboxService> {
    const instance = new SandboxService(
      windowLayoutService,
      logger,
      fileDiffHandler,
      mountResolver,
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

  /**
   * Return and reset the file write count accumulated during the current execution.
   * Called by execute-sandbox-js tool after execution to attach _hasFileWrites marker.
   */
  getAndClearFileWriteCount(agentId: string): number {
    const count = this.fileWriteCountPerExecution.get(agentId) ?? 0;
    this.fileWriteCountPerExecution.delete(agentId);
    return count;
  }

  /** Returns the current sandbox session ID for an agent, or null if no context exists. */
  getSandboxSessionId(agentId: string): string | null {
    return this.sandboxSessionIds.get(agentId) ?? null;
  }

  /**
   * Push the current mount configuration to the sandbox worker for an agent.
   * Called by ToolboxService when mounts change.
   */
  updateAgentMounts(agentId: string, mounts: MountDescriptor[]) {
    const worker = this.agentToWorker.get(agentId);
    if (!worker) return;
    this.safeSend(worker, { type: 'update-mounts', agentId, mounts });
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
    this.sandboxSessionIds.set(agentId, randomUUID());

    this.safeSend(worker, { type: 'create-context', agentId });

    if (this.mountResolver) {
      const mounts = this.mountResolver(agentId);
      if (mounts.length > 0) {
        this.safeSend(worker, {
          type: 'update-mounts',
          agentId,
          mounts,
        });
      }
    }
  }

  destroyAgent(agentId: string) {
    const worker = this.agentToWorker.get(agentId);
    if (!worker) return;

    this.safeSend(worker, { type: 'destroy-context', agentId });
    worker.agentIds.delete(agentId);
    worker.load--;
    this.agentToWorker.delete(agentId);
    this.agentToolCallIds.delete(agentId);
    this.fileWriteCountPerExecution.delete(agentId);
    this.sandboxSessionIds.delete(agentId);
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
      sizeBytes: number;
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
      case 'file-diff-notification': {
        const toolCallId = this.agentToolCallIds.get(msg.agentId);
        if (!this.fileDiffHandler || !toolCallId) return;

        this.fileWriteCountPerExecution.set(
          msg.agentId,
          (this.fileWriteCountPerExecution.get(msg.agentId) ?? 0) + 1,
        );

        try {
          await this.fileDiffHandler(
            msg.agentId,
            msg.absolutePath,
            msg.before,
            msg.after,
            msg.isExternal,
            msg.bytesWritten,
            toolCallId,
          );
        } catch (err) {
          this.logger.error(
            '[SandboxService] Failed to handle file diff notification',
            { error: err, path: msg.absolutePath },
          );
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
      this.sandboxSessionIds.set(agentId, randomUUID());
      this.safeSend(replacement, { type: 'create-context', agentId });
      if (this.mountResolver) {
        const mounts = this.mountResolver(agentId);
        if (mounts.length > 0) {
          this.safeSend(replacement, {
            type: 'update-mounts',
            agentId,
            mounts,
          });
        }
      }
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
    this.fileWriteCountPerExecution.clear();
    this.sandboxSessionIds.clear();
  }
}
