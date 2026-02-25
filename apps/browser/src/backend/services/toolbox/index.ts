import type { Logger } from '@/services/logger';
import { MountManagerService } from './services/mount-manager';
import type { FilePickerService } from '@/services/file-picker';
import type { UserExperienceService } from '@/services/experience';
import { SandboxService } from '../sandbox';
import { APPEND_ONLY_PERMISSIONS, type MountDescriptor } from '../sandbox/ipc';
import type { WorkspaceAgentSettings } from '@shared/karton-contracts/ui/shared-types';
import type { KartonService } from '@/services/karton';
import type { GlobalConfigService } from '@/services/global-config';
import { DisposableService } from '@/services/disposable';
import type { DiffHistoryService } from '@/services/diff-history';
import type { WindowLayoutService } from '@/services/window-layout';
import type { AuthService } from '@/services/auth';
import type { TelemetryService } from '@/services/telemetry';
import type { GlobalDataPathService } from '@/services/global-data-path';
import { createAuthenticatedClient } from './utils/create-authenticated-client';
import { createFileDiffHandler } from './utils/sandbox-callbacks';
import { deleteAgentBlobs, getAgentBlobDir } from '@/utils/attachment-blobs';
import { mkdirSync } from 'node:fs';
import type { AppRouter, TRPCClient } from '@stagewise/api-client';
import {
  deleteFileToolExecute,
  DESCRIPTION as DELETE_FILE_DESCRIPTION,
} from './tools/file-modification/delete-file';
import { globTool } from './tools/file-modification/glob';
import { readFileTool } from './tools/file-modification/read-file';
import { getLintingDiagnosticsTool } from './tools/file-modification/get-linting-diagnostics';
import { listLibraryDocsTool } from './tools/research/list-library-docs';
import { searchInLibraryDocsTool } from './tools/research/search-in-library-docs';
import {
  overwriteFileToolExecute,
  DESCRIPTION as OVERWRITE_FILE_DESCRIPTION,
} from './tools/file-modification/overwrite-file';
import { listFilesTool } from './tools/file-modification/list-files';
import {
  multiEditToolExecute,
  DESCRIPTION as MULTI_EDIT_DESCRIPTION,
} from './tools/file-modification/multi-edit';
import { grepSearchTool } from './tools/file-modification/grep-search';
import { executeSandboxJsTool } from './tools/browser/execute-sandbox-js';
import { readConsoleLogsTool } from './tools/browser/read-console-logs';
import { type Tool, tool } from 'ai';
import {
  buildAgentFileEditContent,
  captureFileState,
  cleanupTempFile,
  type MountedClientRuntimes,
} from './utils';
import path from 'node:path';
import type { z } from 'zod';
import {
  deleteFileToolInputSchema,
  multiEditToolInputSchema,
  overwriteFileToolInputSchema,
  type StagewiseToolSet,
} from '@shared/karton-contracts/ui/agent/tools/types';
import type { BrowserSnapshot, WorkspaceSnapshot } from './types';
import type {
  EnvironmentSnapshot,
  MountPermission,
} from '@shared/karton-contracts/ui/agent/metadata';
import { createEnvironmentDiffSnapshot } from '@/services/diff-history/utils/diff';
import type { WorkspaceInfo } from '@/agents/shared/prompts/utils/workspace-info';
import { getWorkspaceInfo as getWorkspaceInfoUtil } from '@/agents/shared/prompts/utils/workspace-info';
import { readAgentsMd } from '@/agents/shared/prompts/utils/read-agents-md';
import {
  readWorkspaceMd,
  WORKSPACE_MD_DIR,
  WORKSPACE_MD_FILENAME,
} from '@/agents/shared/prompts/utils/read-workspace-md';
import type { ContextFilesResult } from '@shared/karton-contracts/pages-api/types';
import {
  getSkills,
  type Skill,
} from '@/agents/shared/prompts/utils/get-skills';
import { resolveMountedRelativePath } from './utils/path-mounting';

type MountedPrefix = string;
type MountedPath = string;

export class ToolboxService extends DisposableService {
  private readonly logger: Logger;
  private readonly uiKarton: KartonService;
  private readonly globalConfigService: GlobalConfigService;
  private readonly diffHistoryService: DiffHistoryService;
  private readonly windowLayoutService: WindowLayoutService;
  private readonly authService: AuthService;
  private readonly telemetryService: TelemetryService;
  private readonly globalDataPathService: GlobalDataPathService;
  private readonly filePickerService: FilePickerService;
  private readonly userExperienceService: UserExperienceService;

  private sandboxService: SandboxService | null = null;

  private mountManagerService: MountManagerService | null = null;

  /** Cached API client - recreated when auth changes */
  private apiClient: TRPCClient<AppRouter> | null = null;

  public get globalDataPath(): string {
    return this.globalDataPathService.globalDataPath;
  }

  /** Temp directory for capturing file state (external/binary files) */
  private get tempDir(): string {
    return path.join(
      this.globalDataPathService.globalTempPath,
      'agent-temp-files',
    );
  }

  private constructor(
    logger: Logger,
    uiKarton: KartonService,
    globalConfigService: GlobalConfigService,
    diffHistoryService: DiffHistoryService,
    windowLayoutService: WindowLayoutService,
    authService: AuthService,
    telemetryService: TelemetryService,
    globalDataPathService: GlobalDataPathService,
    filePickerService: FilePickerService,
    userExperienceService: UserExperienceService,
  ) {
    super();
    this.logger = logger;
    this.uiKarton = uiKarton;
    this.globalConfigService = globalConfigService;
    this.diffHistoryService = diffHistoryService;
    this.windowLayoutService = windowLayoutService;
    this.authService = authService;
    this.telemetryService = telemetryService;
    this.globalDataPathService = globalDataPathService;
    this.filePickerService = filePickerService;
    this.userExperienceService = userExperienceService;
  }

  public static async create(
    logger: Logger,
    uiKarton: KartonService,
    globalConfigService: GlobalConfigService,
    diffHistoryService: DiffHistoryService,
    windowLayoutService: WindowLayoutService,
    authService: AuthService,
    telemetryService: TelemetryService,
    globalDataPathService: GlobalDataPathService,
    filePickerService: FilePickerService,
    userExperienceService: UserExperienceService,
  ): Promise<ToolboxService> {
    const instance = new ToolboxService(
      logger,
      uiKarton,
      globalConfigService,
      diffHistoryService,
      windowLayoutService,
      authService,
      telemetryService,
      globalDataPathService,
      filePickerService,
      userExperienceService,
    );
    await instance.initialize();
    return instance;
  }

  private report(
    error: Error,
    operation: string,
    extra?: Record<string, unknown>,
  ) {
    this.telemetryService.captureException(error, {
      service: 'toolbox',
      operation,
      ...extra,
    });
  }

  /**
   * Wraps a file-modifying tool to capture before/after state and register with diff-history.
   *
   * @param description - Tool description for AI SDK
   * @param inputSchema - Zod schema for tool input (must have relative_path field)
   * @param executeFn - The actual tool execute function
   * @param agentInstanceId - The agent instance ID for diff-history attribution
   * @returns A wrapped tool that registers edits with diff-history
   */
  private wrapFileModifyingTool<TParams extends { relative_path: string }>(
    description: string,
    inputSchema: z.ZodType<TParams>,
    executeFn: (
      params: TParams,
      mountedRuntimes: MountedClientRuntimes,
    ) => Promise<unknown>,
    agentInstanceId: string,
  ) {
    // Cast to any to bypass AI SDK's strict FlexibleSchema type inference
    // The schemas are validated Zod schemas that work correctly at runtime
    return tool({
      description,
      inputSchema: inputSchema as z.ZodType<TParams>,
      execute: async (params, options) => {
        const mountedRuntimes =
          this.mountManagerService?.getMountedRuntimes(agentInstanceId);
        if (!mountedRuntimes) throw new Error('No mounted workspaces found');
        const { clientRuntime, relativePath } = resolveMountedRelativePath(
          mountedRuntimes,
          params.relative_path,
        );
        const { toolCallId } = options as { toolCallId: string };
        const absolutePath = clientRuntime.fileSystem.resolvePath(relativePath);

        const beforeState = await captureFileState(absolutePath, this.tempDir);
        this.diffHistoryService.ignoreFileForWatcher(absolutePath);
        // Execute the actual tool
        const result = await executeFn(params, mountedRuntimes);
        const afterState = await captureFileState(absolutePath, this.tempDir);

        // Build AgentFileEdit and register with diff-history
        try {
          const { editContent, tempFilesToCleanup } =
            await buildAgentFileEditContent(
              beforeState,
              afterState,
              this.tempDir,
            );

          // Sync with LSP based on operation type
          // File created/modified - update LSP
          if (!editContent.isExternal && editContent.contentAfter !== null)
            void this.mountManagerService?.syncFileWithLsp(
              agentInstanceId,
              absolutePath,
              editContent.contentAfter,
            );
          // File deleted - close in LSP to clear diagnostics
          else if (
            !editContent.isExternal &&
            editContent.contentBefore !== null
          )
            void this.mountManagerService?.syncFileCloseWithLsp(
              agentInstanceId,
              absolutePath,
            );

          await this.diffHistoryService.registerAgentEdit({
            agentInstanceId,
            path: absolutePath,
            toolCallId,
            ...editContent,
          });

          // Clean up temp files after registration
          for (const tempFile of tempFilesToCleanup)
            void cleanupTempFile(tempFile);
        } catch (error) {
          this.logger.error('[ToolboxService] Failed to register agent edit', {
            error,
            path: absolutePath,
            toolCallId,
          });
          this.report(error as Error, 'registerAgentEdit', {
            path: absolutePath,
            toolCallId,
          });
          // Don't fail the tool execution if diff-history registration fails
        } finally {
          setTimeout(
            () => this.diffHistoryService.unignoreFileForWatcher(absolutePath),
            500,
          );
        }

        // Attach diff data for UI rendering (stripped before LLM sees it)
        const _diff =
          !beforeState.isExternal && !afterState.isExternal
            ? { before: beforeState.content, after: afterState.content }
            : null;

        return { ...(result as object), _diff };
      },
    });
  }

  public async getTool<TToolName extends keyof StagewiseToolSet>(
    tool: TToolName,
    agentInstanceId: string,
  ): Promise<StagewiseToolSet[TToolName] | null>;

  /**
   * Used by the agent to get a tool that can be forwarded to the AI-SDK
   *
   * @param tool - the name of the tool that should be returned
   * @param agentInstanceId - the id of the agent instance that is requesting the tool.
   *                            Should be used to link the following tool calls to the given agent instance.
   *
   * @returns the tool that can be forwarded to the AI-SDK
   *
   * @note In order to get the specific tool call ID, the tool's `execute` function should
   *        look at the `options` parameter which includes the `toolCallId` as a property.
   *
   * @note Based on the here provided `agentInstanceId` and the `toolCallId` provided at time of tool execution,
   *        the toolbox can clearly match a tool call to it's related agent and other tool calls made by the agent.
   */
  public async getTool<TToolName extends keyof StagewiseToolSet>(
    tool: TToolName,
    agentInstanceId: string,
  ): Promise<Tool | null> {
    const mountedRuntimes =
      this.mountManagerService?.getMountedRuntimes(agentInstanceId);
    if (!mountedRuntimes) return null;

    const mountedLspServices =
      this.mountManagerService?.getMountedLspServices(agentInstanceId);
    if (!mountedLspServices) return null;

    switch (tool) {
      case 'deleteFileTool':
        if (mountedRuntimes.size === 0) return null;
        return this.wrapFileModifyingTool(
          DELETE_FILE_DESCRIPTION,
          deleteFileToolInputSchema,
          deleteFileToolExecute,
          agentInstanceId,
        );
      case 'globTool':
        if (mountedRuntimes.size === 0) return null;
        return globTool(mountedRuntimes);
      case 'grepSearchTool':
        if (mountedRuntimes.size === 0) return null;
        return grepSearchTool(mountedRuntimes);
      case 'listFilesTool':
        if (mountedRuntimes.size === 0) return null;
        return listFilesTool(mountedRuntimes);
      case 'multiEditTool':
        if (mountedRuntimes.size === 0) return null;
        return this.wrapFileModifyingTool(
          MULTI_EDIT_DESCRIPTION,
          multiEditToolInputSchema,
          multiEditToolExecute,
          agentInstanceId,
        );
      case 'overwriteFileTool':
        if (mountedRuntimes.size === 0) return null;
        return this.wrapFileModifyingTool(
          OVERWRITE_FILE_DESCRIPTION,
          overwriteFileToolInputSchema,
          overwriteFileToolExecute,
          agentInstanceId,
        );
      case 'readFileTool':
        if (mountedRuntimes.size === 0) return null;
        return readFileTool(mountedRuntimes);
      case 'listLibraryDocsTool':
        if (!this.apiClient) return null;
        return listLibraryDocsTool(this.apiClient);
      case 'searchInLibraryDocsTool':
        if (!this.apiClient) return null;
        return searchInLibraryDocsTool(this.apiClient);
      case 'getLintingDiagnosticsTool': {
        if (!mountedLspServices) return null;
        return getLintingDiagnosticsTool(mountedLspServices);
      }
      case 'executeSandboxJsTool':
        if (!this.windowLayoutService) return null;
        return executeSandboxJsTool(this.sandboxService!, agentInstanceId);
      case 'readConsoleLogsTool':
        if (!this.windowLayoutService) return null;
        return readConsoleLogsTool(this.windowLayoutService);
      default:
        this.logger.error('[ToolboxService] Tool not found', { tool });
        return null;
    }
  }

  /**
   * Used by the agent to undo all tool calls given by IDs.
   *
   * @param toolCallIds - the ids of the tool calls that should be undone
   *
   * @note The toolbox should revert all given tool calls by reverting to the
   *        last known state of affected files before the first tool call was executed.
   *
   * @note If multiple given tools calls affect the same file, the toolbox should revert to the previous version
   *        of the earliest related tool call in the list, and all other tool calls affecting the same file
   *        are also to be treated as "reverted".
   */
  public async undoToolCalls(toolCallIds: string[]): Promise<void> {
    return this.diffHistoryService.undoToolCalls(toolCallIds);
  }

  public getWorkspaceSnapshot(agentInstanceId: string): WorkspaceSnapshot {
    return (
      this.mountManagerService?.getWorkspaceSnapshot(agentInstanceId) ?? {
        mounts: [],
      }
    );
  }

  public async handleMountWorkspace(
    agentInstanceId: string,
    workspacePath: string,
    permissions?: MountPermission[],
  ) {
    await this.mountManagerService?.handleMountWorkspace(
      agentInstanceId,
      workspacePath,
      permissions,
    );
  }

  public async handleUnmountWorkspace(
    agentInstanceId: string,
    mountPrefix: string,
  ) {
    await this.mountManagerService?.handleUnmountWorkspace(
      agentInstanceId,
      mountPrefix,
    );
  }

  /**
   * Push current mount configuration for an agent to the sandbox worker
   * so the isolated fs stays in sync.
   */
  private getSandboxMounts(agentInstanceId: string): MountDescriptor[] {
    const mountsWithRt =
      this.mountManagerService?.getMountedPathsWithRuntimes(agentInstanceId);
    const mounts: MountDescriptor[] =
      mountsWithRt?.map((m) => ({
        prefix: m.prefix,
        absolutePath: m.path,
        permissions: m.permissions,
      })) ?? [];

    const attDir = getAgentBlobDir(
      this.globalDataPathService.globalDataPath,
      agentInstanceId,
    );
    mkdirSync(attDir, { recursive: true });
    mounts.push({
      prefix: 'att',
      absolutePath: attDir,
      permissions: APPEND_ONLY_PERMISSIONS,
    });

    return mounts;
  }

  private pushMountsToSandbox(agentInstanceId: string) {
    if (!this.sandboxService) return;
    this.sandboxService.updateAgentMounts(
      agentInstanceId,
      this.getSandboxMounts(agentInstanceId),
    );
  }

  public setWorkspaceMdContent(
    workspacePath: string,
    content: string | null,
  ): void {
    this.mountManagerService?.setWorkspaceMdContent(workspacePath, content);
  }

  public async getWorkspaceInfo(
    agentInstanceId: string,
  ): Promise<WorkspaceInfo[]> {
    const mountsWithRt =
      this.mountManagerService?.getMountedRuntimes(agentInstanceId);
    if (!mountsWithRt) return [];
    if (mountsWithRt.size === 0) return [];
    return Promise.all(
      [...mountsWithRt.values()].map((m) => getWorkspaceInfoUtil(m)),
    );
  }

  public getBrowserSnapshot(): BrowserSnapshot {
    const browser = this.uiKarton.state.browser;
    const activeTab = browser.activeTabId
      ? browser.tabs[browser.activeTabId]
      : null;

    const allTabs = Object.values(browser.tabs)
      .sort((a, b) => b.lastFocusedAt - a.lastFocusedAt)
      .map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        error: tab.error
          ? { code: tab.error.code, message: tab.error.message }
          : null,
        consoleLogCount: tab.consoleLogCount,
        consoleErrorCount: tab.consoleErrorCount,
        handle: tab.handle,
        lastFocusedAt: tab.lastFocusedAt,
      }));

    return {
      activeTab: activeTab
        ? {
            id: activeTab.id,
            title: activeTab.title,
            url: activeTab.url,
            error: activeTab.error,
            consoleLogCount: activeTab.consoleLogCount,
            consoleErrorCount: activeTab.consoleErrorCount,
            handle: activeTab.handle,
          }
        : null,
      tabs: allTabs,
      totalTabCount: Object.keys(browser.tabs).length,
    };
  }

  public captureEnvironmentSnapshot(
    agentInstanceId: string,
  ): EnvironmentSnapshot {
    const browserState = this.getBrowserSnapshot();
    const workspaceState =
      this.mountManagerService?.getWorkspaceSnapshot(agentInstanceId);
    const toolboxState = this.uiKarton.state.toolbox[agentInstanceId];

    const workspaceMounts = workspaceState?.mounts ?? [];
    const allMounts = [
      ...workspaceMounts,
      {
        prefix: 'att',
        path: getAgentBlobDir(
          this.globalDataPathService.globalDataPath,
          agentInstanceId,
        ),
        permissions: [...APPEND_ONLY_PERMISSIONS] as MountPermission[],
      },
    ];

    const snapshot: EnvironmentSnapshot = {
      browser: {
        tabs: browserState.tabs.map((t) => ({
          handle: t.handle,
          url: t.url,
          title: t.title,
        })),
        activeTabHandle: browserState.activeTab?.handle ?? null,
      },
      workspace: { mounts: allMounts },
      fileDiffs: toolboxState
        ? createEnvironmentDiffSnapshot(
            toolboxState.pendingFileDiffs,
            toolboxState.editSummary,
          )
        : { pending: [], summary: [] },
    };

    return snapshot;
  }

  public async getSkillsList(agentInstanceId: string): Promise<Skill[]> {
    const mounts =
      this.mountManagerService?.getMountedPathsWithRuntimes(agentInstanceId);
    if (!mounts) return [];
    if (mounts.length === 0) return [];

    const result: Skill[] = [];

    for (const mount of mounts) {
      const settings = this.uiKarton.state.preferences?.agent
        ?.workspaceSettings?.[mount.path] ?? {
        respectAgentsMd: false,
        disabledSkills: [],
      };
      const disabled = new Set(settings.disabledSkills);
      const skills = await getSkills(mount.clientRuntime);

      for (const skill of skills) {
        if (disabled.has(skill.name)) continue;
        result.push(skill);
      }
    }

    return result;
  }

  public getWorkspaceAgentSettings(
    agentInstanceId: string,
  ): Map<string, WorkspaceAgentSettings> {
    const mounts =
      this.mountManagerService?.getMountedPathsWithRuntimes(agentInstanceId);
    const result = new Map<string, WorkspaceAgentSettings>();
    for (const mount of mounts ?? []) {
      result.set(
        mount.prefix,
        this.uiKarton.state.preferences?.agent?.workspaceSettings?.[
          mount.path
        ] ?? { respectAgentsMd: false, disabledSkills: [] },
      );
    }
    return result;
  }

  public async getAgentsMd(
    agentInstanceId: string,
  ): Promise<Array<{ mountPrefix: string; content: string }>> {
    const mounts =
      this.mountManagerService?.getMountedPathsWithRuntimes(agentInstanceId);
    if (!mounts) return [];
    if (mounts.length === 0) return [];
    const results: Array<{ mountPrefix: string; content: string }> = [];
    for (const mount of mounts) {
      const settings = this.uiKarton.state.preferences?.agent
        ?.workspaceSettings?.[mount.path] ?? {
        respectAgentsMd: false,
        disabledSkills: [],
      };
      if (!settings.respectAgentsMd) continue;
      const content = await readAgentsMd(mount.clientRuntime);
      if (content) results.push({ mountPrefix: mount.prefix, content });
    }
    return results;
  }

  public async getWorkspaceMd(
    agentInstanceId: string,
  ): Promise<Array<{ mountPrefix: string; path: string; content: string }>> {
    const mounts =
      this.mountManagerService?.getMountedPathsWithRuntimes(agentInstanceId);
    if (!mounts) return [];
    if (mounts.length === 0) return [];
    const results: Array<{
      mountPrefix: string;
      path: string;
      content: string;
    }> = [];
    for (const mount of mounts) {
      const content = await readWorkspaceMd(mount.path);
      if (content) {
        results.push({
          mountPrefix: mount.prefix,
          path: mount.path,
          content,
        });
      }
    }
    return results;
  }

  public async getContextFilesForAllWorkspaces(): Promise<ContextFilesResult> {
    const uniquePaths = this.mountManagerService?.getAllMountedPaths();
    const result: ContextFilesResult = {};

    await Promise.all(
      [...(uniquePaths ?? [])].map(async (wsPath) => {
        const clientRuntime =
          this.mountManagerService?.getClientRuntimeForPath(wsPath);
        if (!clientRuntime) return;

        const workspaceMdPath = path.resolve(
          wsPath,
          WORKSPACE_MD_DIR,
          WORKSPACE_MD_FILENAME,
        );
        const agentsMdPath = path.resolve(wsPath, 'AGENTS.md');

        const [workspaceMdContent, agentsMdContent] = await Promise.all([
          readWorkspaceMd(wsPath),
          clientRuntime ? readAgentsMd(clientRuntime) : null,
        ]);

        result[wsPath] = {
          workspaceMd: {
            exists: workspaceMdContent !== null,
            path: workspaceMdPath,
            content: workspaceMdContent,
          },
          agentsMd: {
            exists: agentsMdContent !== null,
            path: agentsMdPath,
            content: agentsMdContent,
          },
        };
      }),
    );

    return result;
  }

  /**
   * Get or create an authenticated API client.
   * Returns null if not authenticated.
   */
  private getOrCreateApiClient(): TRPCClient<AppRouter> | null {
    const accessToken = this.authService.accessToken;
    if (!accessToken) {
      this.apiClient = null;
      return null;
    }

    // Create new client if not cached
    if (!this.apiClient) {
      try {
        this.apiClient = createAuthenticatedClient(accessToken);
      } catch (error) {
        this.logger.error(
          '[ToolboxService] Failed to create authenticated client',
          { error },
        );
        this.report(error as Error, 'createApiClient');
        return null;
      }
    }

    return this.apiClient;
  }

  public getMountedPathsForAgent(
    agentInstanceId: string,
  ): Map<MountedPrefix, MountedPath> {
    const mounts =
      this.mountManagerService?.getMountedPathsWithRuntimes(agentInstanceId);
    if (!mounts) return new Map();
    const result = new Map<MountedPrefix, MountedPath>();
    for (const mount of mounts) result.set(mount.prefix, mount.path);

    return result;
  }

  public getWorkspaceSnapshotForPersistence(
    agentInstanceId: string,
  ): Array<{ path: string; permissions: MountPermission[] }> {
    const mounts =
      this.mountManagerService?.getMountedPathsWithRuntimes(agentInstanceId);
    if (!mounts) return [];
    return mounts.map((m) => ({
      path: m.path,
      permissions: m.permissions,
    }));
  }

  /**
   * Refresh the API client (e.g., after auth state changes).
   * Call this when the auth token is refreshed.
   */
  public refreshApiClient(): void {
    this.apiClient = null;
    this.apiClient = this.getOrCreateApiClient();
  }

  public async acceptAllPendingEditsForAgent(
    agentInstanceId: string,
  ): Promise<void> {
    await this.diffHistoryService.acceptAllPendingEditsForAgent(
      agentInstanceId,
    );
  }

  /**
   * Clear tracking data for a specific agent instance.
   * Call this when an agent session ends.
   */
  public clearAgentTracking(agentInstanceId: string): void {
    this.mountManagerService?.clearAgentMounts(agentInstanceId);
    this.sandboxService?.destroyAgent(agentInstanceId);
    void deleteAgentBlobs(
      this.globalDataPathService.globalDataPath,
      agentInstanceId,
    );
  }

  private async initialize(): Promise<void> {
    this.logger.debug('[ToolboxService] Initializing...');

    // Eagerly initialize the API client if auth is already available
    this.apiClient = this.getOrCreateApiClient();

    this.mountManagerService = await MountManagerService.create(
      this.logger,
      this.filePickerService,
      this.globalDataPathService,
      this.userExperienceService,
      this.uiKarton,
      this.telemetryService,
    );

    this.mountManagerService.setOnMountsChanged((agentInstanceId) => {
      this.pushMountsToSandbox(agentInstanceId);
    });

    const fileDiffHandler = createFileDiffHandler({
      mountManager: this.mountManagerService,
      diffHistoryService: this.diffHistoryService,
      logger: this.logger,
      telemetryService: this.telemetryService,
    });

    this.sandboxService = await SandboxService.create(
      this.windowLayoutService,
      this.logger,
      fileDiffHandler,
      (agentId) => this.getSandboxMounts(agentId),
    );

    // Use arrow function to preserve `this` binding when called as callback
    this.authService.registerAuthStateChangeCallback(() =>
      this.refreshApiClient(),
    );
  }

  protected onTeardown(): Promise<void> | void {
    this.apiClient = null;

    void this.mountManagerService?.teardown();
    this.mountManagerService = null;

    void this.sandboxService?.teardown();
    this.sandboxService = null;
  }
}
