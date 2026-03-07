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
import type { KartonService } from '@/services/karton';

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

interface SandboxAttachmentMeta {
  id: string;
  mediaType: string;
  fileName?: string;
  sizeBytes: number;
}

export class SandboxService extends DisposableService {
  private readonly windowLayoutService: WindowLayoutService;
  private readonly logger: Logger;
  private readonly fileDiffHandler?: FileDiffHandler;
  private readonly mountResolver?: MountResolver;
  private readonly kartonService?: KartonService;
  private workers: WorkerInfo[] = [];
  private agentToWorker = new Map<string, WorkerInfo>();
  private pendingRequests = new Map<string, PendingRequest>();
  private agentToolCallIds = new Map<string, string>();
  private fileWriteCountPerExecution = new Map<string, number>();
  private sandboxSessionIds = new Map<string, string>();
  private reqId = 0;

  private outputBuffers = new Map<string, string[]>();
  private attachmentBuffers = new Map<string, SandboxAttachmentMeta[]>();
  private outputFlushTimers = new Map<string, NodeJS.Timeout>();
  private outputMaxIntervalTimers = new Map<string, NodeJS.Timeout>();

  /** Per-agent CDP event subscriptions. Outer key = agentId, inner key = "tabId\0event", value = unsubscribe fn from WindowLayoutService. */
  private cdpSubscriptions = new Map<string, Map<string, () => void>>();

  constructor(
    windowLayoutService: WindowLayoutService,
    logger: Logger,
    fileDiffHandler?: FileDiffHandler,
    mountResolver?: MountResolver,
    kartonService?: KartonService,
    private poolSize = 4,
  ) {
    super();
    this.windowLayoutService = windowLayoutService;
    this.logger = logger;
    this.fileDiffHandler = fileDiffHandler;
    this.mountResolver = mountResolver;
    this.kartonService = kartonService;
  }

  public static async create(
    windowLayoutService: WindowLayoutService,
    logger: Logger,
    fileDiffHandler?: FileDiffHandler,
    mountResolver?: MountResolver,
    kartonService?: KartonService,
  ): Promise<SandboxService> {
    const instance = new SandboxService(
      windowLayoutService,
      logger,
      fileDiffHandler,
      mountResolver,
      kartonService,
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

    this.cleanupCdpSubscriptions(agentId);
  }

  async execute(
    agentId: string,
    code: string,
    timeoutMs = 190_000, // just over 3 min — must exceed the worker's 180s hard cap
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
      case 'sandbox-output': {
        const toolCallId = this.agentToolCallIds.get(msg.agentId);
        if (!toolCallId || !this.kartonService) return;
        if (!this.outputBuffers.has(toolCallId)) {
          this.outputBuffers.set(toolCallId, []);
        }
        this.outputBuffers.get(toolCallId)!.push(msg.output);
        this.scheduleFlush(msg.agentId, toolCallId);
        break;
      }
      case 'sandbox-output-attachment': {
        const toolCallId = this.agentToolCallIds.get(msg.agentId);
        if (!toolCallId || !this.kartonService) return;
        if (!this.attachmentBuffers.has(toolCallId)) {
          this.attachmentBuffers.set(toolCallId, []);
        }
        this.attachmentBuffers.get(toolCallId)!.push(msg.attachment);
        this.scheduleFlush(msg.agentId, toolCallId);
        break;
      }
      case 'subscribe-cdp-event': {
        try {
          const key = `${msg.tabId}\0${msg.event}`;
          let agentSubs = this.cdpSubscriptions.get(msg.agentId);
          if (!agentSubs) {
            agentSubs = new Map();
            this.cdpSubscriptions.set(msg.agentId, agentSubs);
          }
          if (agentSubs.has(key)) break;

          const unsubscribe = this.windowLayoutService.subscribeCDPEvent(
            msg.tabId,
            msg.event,
            (params) => {
              this.safeSend(worker, {
                type: 'cdp-event',
                agentId: msg.agentId,
                tabId: msg.tabId,
                event: msg.event,
                params,
              });
            },
          );
          agentSubs.set(key, unsubscribe);
        } catch (err) {
          this.logger.warn(
            `[SandboxService] Failed to subscribe CDP event: ${err}`,
          );
        }
        break;
      }
      case 'unsubscribe-cdp-event': {
        const key = `${msg.tabId}\0${msg.event}`;
        const agentSubs = this.cdpSubscriptions.get(msg.agentId);
        const unsub = agentSubs?.get(key);
        if (unsub) {
          unsub();
          agentSubs!.delete(key);
          if (agentSubs!.size === 0) {
            this.cdpSubscriptions.delete(msg.agentId);
          }
        }
        break;
      }
    }
  }
  private static readonly FLUSH_DEBOUNCE_MS = 100;
  private static readonly FLUSH_MAX_INTERVAL_MS = 300;
  private static readonly MAX_STREAMING_BYTES = 51_200;

  private scheduleFlush(agentId: string, toolCallId: string) {
    const existingDebounce = this.outputFlushTimers.get(toolCallId);
    if (existingDebounce) clearTimeout(existingDebounce);

    this.outputFlushTimers.set(
      toolCallId,
      setTimeout(
        () => this.flushToKarton(agentId, toolCallId),
        SandboxService.FLUSH_DEBOUNCE_MS,
      ),
    );

    if (!this.outputMaxIntervalTimers.has(toolCallId)) {
      this.outputMaxIntervalTimers.set(
        toolCallId,
        setTimeout(
          () => this.flushToKarton(agentId, toolCallId),
          SandboxService.FLUSH_MAX_INTERVAL_MS,
        ),
      );
    }
  }

  private flushToKarton(agentId: string, toolCallId: string) {
    if (!this.kartonService) return;

    const debounce = this.outputFlushTimers.get(toolCallId);
    if (debounce) {
      clearTimeout(debounce);
      this.outputFlushTimers.delete(toolCallId);
    }
    const maxInterval = this.outputMaxIntervalTimers.get(toolCallId);
    if (maxInterval) {
      clearTimeout(maxInterval);
      this.outputMaxIntervalTimers.delete(toolCallId);
    }

    const outputs = this.outputBuffers.get(toolCallId);
    const attachments = this.attachmentBuffers.get(toolCallId);
    if (!outputs?.length && !attachments?.length) return;

    let outputsSnapshot: string[];
    if (outputs) {
      const joined = outputs.join('');
      if (joined.length > SandboxService.MAX_STREAMING_BYTES)
        outputsSnapshot = [joined.slice(-SandboxService.MAX_STREAMING_BYTES)];
      else outputsSnapshot = [...outputs];
    } else {
      outputsSnapshot = [];
    }
    const attachmentsSnapshot = attachments ? [...attachments] : [];

    this.kartonService.setState((draft) => {
      if (!draft.toolbox[agentId]) {
        draft.toolbox[agentId] = {
          workspace: { mounts: [] },
          pendingFileDiffs: [],
          editSummary: [],
          pendingUserQuestion: null,
        };
      }
      if (outputsSnapshot.length > 0) {
        if (!draft.toolbox[agentId].pendingSandboxOutputs)
          draft.toolbox[agentId].pendingSandboxOutputs = {};

        draft.toolbox[agentId].pendingSandboxOutputs![toolCallId] =
          outputsSnapshot;
      }
      if (attachmentsSnapshot.length > 0) {
        if (!draft.toolbox[agentId].pendingSandboxAttachments)
          draft.toolbox[agentId].pendingSandboxAttachments = {};

        draft.toolbox[agentId].pendingSandboxAttachments![toolCallId] =
          attachmentsSnapshot;
      }
    });
  }

  clearPendingOutputs(agentId: string, toolCallId: string) {
    this.outputBuffers.delete(toolCallId);
    this.attachmentBuffers.delete(toolCallId);

    const debounce = this.outputFlushTimers.get(toolCallId);
    if (debounce) {
      clearTimeout(debounce);
      this.outputFlushTimers.delete(toolCallId);
    }
    const maxInterval = this.outputMaxIntervalTimers.get(toolCallId);
    if (maxInterval) {
      clearTimeout(maxInterval);
      this.outputMaxIntervalTimers.delete(toolCallId);
    }

    if (!this.kartonService) return;
    const agentToolbox = this.kartonService.state.toolbox[agentId];
    if (!agentToolbox) return;

    const hasOutputs =
      agentToolbox.pendingSandboxOutputs?.[toolCallId] !== undefined;
    const hasAttachments =
      agentToolbox.pendingSandboxAttachments?.[toolCallId] !== undefined;
    if (!hasOutputs && !hasAttachments) return;

    this.kartonService.setState((draft) => {
      const tb = draft.toolbox[agentId];
      if (!tb) return;
      if (tb.pendingSandboxOutputs?.[toolCallId])
        delete tb.pendingSandboxOutputs[toolCallId];

      if (tb.pendingSandboxAttachments?.[toolCallId])
        delete tb.pendingSandboxAttachments[toolCallId];
    });
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
      this.cleanupCdpSubscriptions(agentId);
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

  private cleanupCdpSubscriptions(agentId: string) {
    const agentSubs = this.cdpSubscriptions.get(agentId);
    if (!agentSubs) return;
    for (const unsub of agentSubs.values()) {
      try {
        unsub();
      } catch {
        // Tab may already be destroyed
      }
    }
    this.cdpSubscriptions.delete(agentId);
  }

  protected onTeardown(): Promise<void> | void {
    for (const worker of this.workers) worker.process.kill();

    this.workers = [];
    this.agentToWorker.clear();
    this.pendingRequests.clear();
    this.agentToolCallIds.clear();
    this.fileWriteCountPerExecution.clear();
    this.sandboxSessionIds.clear();

    for (const agentId of this.cdpSubscriptions.keys())
      this.cleanupCdpSubscriptions(agentId);

    for (const timer of this.outputFlushTimers.values()) clearTimeout(timer);
    this.outputFlushTimers.clear();
    for (const timer of this.outputMaxIntervalTimers.values())
      clearTimeout(timer);
    this.outputMaxIntervalTimers.clear();
    this.outputBuffers.clear();
    this.attachmentBuffers.clear();
  }
}
