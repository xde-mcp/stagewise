import { DisposableService } from '../disposable';
import type { Logger } from '../logger';
import type { WindowLayoutService } from '../window-layout';
import { utilityProcess } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMainIPC, type WorkerToMainMessage } from './ipc';

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
  private workers: WorkerInfo[] = [];
  private agentToWorker = new Map<string, WorkerInfo>();
  private pendingRequests = new Map<string, PendingRequest>();
  private reqId = 0;

  constructor(
    windowLayoutService: WindowLayoutService,
    logger: Logger,
    private poolSize = 4,
  ) {
    super();
    this.windowLayoutService = windowLayoutService;
    this.logger = logger;
  }

  public static async create(
    windowLayoutService: WindowLayoutService,
    logger: Logger,
  ): Promise<SandboxService> {
    const instance = new SandboxService(windowLayoutService, logger);
    await instance.initialize();
    return instance;
  }

  async initialize() {
    for (let i = 0; i < this.poolSize; i++)
      this.workers.push(this.spawnWorker());
  }

  private spawnWorker(): WorkerInfo {
    const child = utilityProcess.fork(SANDBOX_WORKER_PATH, [], {
      execArgv: ['--max-old-space-size=256'],
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
  }

  async execute(
    agentId: string,
    code: string,
    timeoutMs = 30_000,
  ): Promise<any> {
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
        msg.error
          ? pending.reject(new Error(msg.error))
          : pending.resolve(msg.value);
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
  }
}
