import type { ChildProcess } from 'node:child_process';

export type ShellType = 'bash' | 'zsh' | 'sh' | 'powershell' | 'cmd';

export interface DetectedShell {
  type: ShellType;
  path: string;
}

export interface ShellExecutionRequest {
  command: string;
  cwd: string;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

export interface ShellExecutionResult {
  output: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  aborted: boolean;
}

export interface TrackedProcess {
  child: ChildProcess;
  executionId: string;
  agentInstanceId: string;
  toolCallId: string;
  timeoutHandle: NodeJS.Timeout | null;
  startedAt: number;
  exited: boolean;
  markAborted?: () => void;
}

export const DEFAULT_TIMEOUT_MS = 120_000;
export const HEAD_LINES = 100;
export const TAIL_LINES = 300;
export const MAX_COLLECT_BYTES = 5 * 1024 * 1024;
