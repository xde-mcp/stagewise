import type { AggregatedDiagnostic } from '@/services/workspace/services/lsp/types';
import type { ToolboxService } from '.';

/**
 * Simplified snapshot of browser state for use in agents (e.g. system prompt building).
 */
export type BrowserSnapshot = {
  activeTab: BrowserTabInfo | null;
  tabs: (BrowserTabInfo & { lastFocusedAt: number })[];
  totalTabCount: number;
};

export type BrowserTabInfo = {
  id: string;
  title: string;
  url: string;
  error: { code: number; message?: string } | null;
  consoleLogCount: number;
  consoleErrorCount: number;
  handle: string;
};

/**
 * Snapshot of workspace connection state and paths.
 */
export type WorkspaceSnapshot = {
  isConnected: boolean;
  workspacePath: string | null;
  cwd: string | null;
  workspaceMdPath: string | null;
};

/**
 * Map of absolute file paths to their aggregated LSP diagnostics.
 */
export type DiagnosticsByFile = Map<string, AggregatedDiagnostic[]>;

/**
 * Narrowed type that only exposes the context-providing getters
 * from the Toolbox. Used by prompt/context builders to avoid pulling
 * in the complex `AllToolsUnion` generic when only data access is
 * needed.
 */
export type ToolboxContextProvider = Pick<
  ToolboxService,
  | 'getWorkspaceSnapshot'
  | 'getWorkspaceInfo'
  | 'getBrowserSnapshot'
  | 'captureEnvironmentSnapshot'
  | 'getAgentsMd'
  | 'getWorkspaceMd'
  | 'getLspDiagnosticsForAgent'
  | 'getSkillsList'
>;
