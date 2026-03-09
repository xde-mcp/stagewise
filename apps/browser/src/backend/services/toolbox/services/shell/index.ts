import { DisposableService } from '../../../disposable';
import type { Logger } from '../../../logger';
import type { KartonService } from '@/services/karton';
import { detectShell } from './detect-shell';
import { resolveShellEnv } from './resolve-shell-env';
import { sanitizeEnv } from './sanitize-env';
import { ProcessManager } from './process-manager';
import type {
  DetectedShell,
  ShellExecutionRequest,
  ShellExecutionResult,
} from './types';

export class ShellService extends DisposableService {
  private readonly logger: Logger;
  private readonly kartonService?: KartonService;

  private shell: DetectedShell | null = null;
  private processManager: ProcessManager | null = null;
  private resolvedEnv: Record<string, string> | null = null;

  private readonly outputBuffers = new Map<string, string[]>();
  private readonly outputFlushTimers = new Map<string, NodeJS.Timeout>();
  private readonly outputMaxIntervalTimers = new Map<string, NodeJS.Timeout>();

  private static readonly FLUSH_DEBOUNCE_MS = 100;
  private static readonly FLUSH_MAX_INTERVAL_MS = 300;
  private static readonly MAX_STREAMING_BYTES = 51_200;

  constructor(logger: Logger, kartonService?: KartonService) {
    super();
    this.logger = logger;
    this.kartonService = kartonService;
  }

  public static async create(
    logger: Logger,
    kartonService?: KartonService,
  ): Promise<ShellService> {
    const instance = new ShellService(logger, kartonService);
    await instance.initialize();
    return instance;
  }

  async initialize() {
    this.shell = detectShell();
    if (this.shell) {
      this.logger.info(
        `[ShellService] Detected shell: ${this.shell.type} at ${this.shell.path}`,
      );
      this.processManager = new ProcessManager(this.shell);

      try {
        this.resolvedEnv = await resolveShellEnv(this.shell);
        if (this.resolvedEnv) {
          this.logger.info(
            '[ShellService] Resolved shell environment successfully',
          );
        } else {
          this.logger.warn(
            '[ShellService] Could not resolve shell environment — falling back to process.env',
          );
        }
      } catch (err) {
        this.logger.warn(
          '[ShellService] Error resolving shell environment — falling back to process.env',
          err,
        );
      }
    } else {
      this.logger.warn(
        '[ShellService] No usable shell detected — shell tool will be unavailable',
      );
    }
  }

  isAvailable(): boolean {
    return this.shell !== null;
  }

  getShellInfo(): DetectedShell | null {
    return this.shell;
  }

  async execute(
    agentInstanceId: string,
    toolCallId: string,
    request: ShellExecutionRequest,
  ): Promise<ShellExecutionResult> {
    this.assertNotDisposed();

    if (!this.shell || !this.processManager) {
      return {
        output: '',
        stderr: 'Shell service is not available — no shell detected.',
        exitCode: null,
        timedOut: false,
        aborted: false,
      };
    }

    const env = sanitizeEnv(this.resolvedEnv);

    const onOutput = (chunk: string) => {
      if (!this.kartonService) return;
      if (!this.outputBuffers.has(toolCallId)) {
        this.outputBuffers.set(toolCallId, []);
      }
      this.outputBuffers.get(toolCallId)!.push(chunk);
      this.scheduleFlush(agentInstanceId, toolCallId);
    };

    const { result } = this.processManager.spawn(
      agentInstanceId,
      request,
      env,
      onOutput,
      toolCallId,
    );

    return result;
  }

  clearPendingOutputs(agentId: string, toolCallId: string): void {
    this.outputBuffers.delete(toolCallId);

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
    if (!agentToolbox?.pendingShellOutputs?.[toolCallId]) return;

    this.kartonService.setState((draft) => {
      const tb = draft.toolbox[agentId];
      if (tb?.pendingShellOutputs?.[toolCallId]) {
        delete tb.pendingShellOutputs[toolCallId];
      }
    });
  }

  cancelCommand(toolCallId: string): void {
    this.processManager?.killByToolCallId(toolCallId);
  }

  destroyAgent(agentInstanceId: string): void {
    const toolCallIds =
      this.processManager?.getToolCallIdsForAgent(agentInstanceId) ?? [];
    this.processManager?.killByAgent(agentInstanceId);
    for (const toolCallId of toolCallIds)
      this.clearPendingOutputs(agentInstanceId, toolCallId);
  }

  private scheduleFlush(agentId: string, toolCallId: string): void {
    const existingDebounce = this.outputFlushTimers.get(toolCallId);
    if (existingDebounce) clearTimeout(existingDebounce);

    this.outputFlushTimers.set(
      toolCallId,
      setTimeout(
        () => this.flushToKarton(agentId, toolCallId),
        ShellService.FLUSH_DEBOUNCE_MS,
      ),
    );

    if (!this.outputMaxIntervalTimers.has(toolCallId)) {
      this.outputMaxIntervalTimers.set(
        toolCallId,
        setTimeout(
          () => this.flushToKarton(agentId, toolCallId),
          ShellService.FLUSH_MAX_INTERVAL_MS,
        ),
      );
    }
  }

  private flushToKarton(agentId: string, toolCallId: string): void {
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
    if (!outputs?.length) return;

    let snapshot: string[];
    const joined = outputs.join('');
    if (joined.length > ShellService.MAX_STREAMING_BYTES)
      snapshot = [joined.slice(-ShellService.MAX_STREAMING_BYTES)];
    else snapshot = [...outputs];

    this.kartonService.setState((draft) => {
      if (!draft.toolbox[agentId]) {
        draft.toolbox[agentId] = {
          workspace: { mounts: [] },
          pendingFileDiffs: [],
          editSummary: [],
          pendingUserQuestion: null,
        };
      }

      if (!draft.toolbox[agentId].pendingShellOutputs) {
        draft.toolbox[agentId].pendingShellOutputs = {};
      }

      draft.toolbox[agentId].pendingShellOutputs![toolCallId] = snapshot;
    });
  }

  protected onTeardown(): Promise<void> | void {
    this.processManager?.killAll();
    this.processManager = null;

    for (const timer of this.outputFlushTimers.values()) clearTimeout(timer);

    this.outputFlushTimers.clear();
    for (const timer of this.outputMaxIntervalTimers.values())
      clearTimeout(timer);

    this.outputMaxIntervalTimers.clear();
    this.outputBuffers.clear();
  }
}
