import type { Logger } from '@/services/logger';
import type { KartonService } from '@/services/karton';
import type { GlobalConfigService } from '@/services/global-config';
import { DisposableService } from '@/services/disposable';
import type { DiffHistoryService } from '@/services/agent/diff-history/index.new';
import type { WindowLayoutService } from '@/services/window-layout';
import type { AuthService } from '@/services/auth';
import type { TelemetryService } from '@/services/telemetry';
import type { GlobalDataPathService } from '@/services/global-data-path';
import type { ClientRuntimeNode } from '@stagewise/agent-runtime-node';
import { createAuthenticatedClient } from '@/services/agent/utils/create-authenticated-client';
import { LspService } from '@/services/workspace/services/lsp';
import type { AppRouter, TRPCClient } from '@stagewise/api-client';
import {
  deleteFileToolExecute,
  DESCRIPTION as DELETE_FILE_DESCRIPTION,
} from './tools/file-modification/delete-file';
import { globTool } from './tools/file-modification/glob';
import { readFileTool } from './tools/file-modification/read-file';
import { getLintingDiagnosticsTool } from './tools/file-modification/get-linting-diagnostics';
import { resolveContext7LibraryTool } from './tools/research/resolve-context7-library';
import { getContext7LibraryDocsTool } from './tools/research/get-context7-library-docs';
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
import { executeConsoleScriptTool } from './tools/browser/execute-console-script';
import { readConsoleLogsTool } from './tools/browser/read-console-logs';
import { tool } from 'ai';
import {
  buildAgentFileEditContent,
  captureFileState,
  cleanupTempFile,
} from './utils';
import path from 'node:path';
import type { z } from 'zod';
import {
  deleteFileToolInputSchema,
  multiEditToolInputSchema,
  overwriteFileToolInputSchema,
  type UITools,
} from '@shared/karton-contracts/ui/tools/types';

type AgentInstanceId = string;

export class ToolboxService extends DisposableService {
  private readonly logger: Logger;
  private readonly uiKarton: KartonService;
  private readonly globalConfigService: GlobalConfigService;
  private readonly diffHistoryService: DiffHistoryService;
  private readonly windowLayoutService: WindowLayoutService;
  private readonly authService: AuthService;
  private readonly telemetryService: TelemetryService;
  private readonly globalDataPathService: GlobalDataPathService;

  /** Client runtime for workspace operations - set via setClientRuntime() */
  private clientRuntime: ClientRuntimeNode | null = null;

  /** LSP service for diagnostics - created when clientRuntime is set */
  private lspService: LspService | null = null;

  /** Promise that resolves when LSP service is ready (or null if no workspace) */
  private lspReady: Promise<LspService | null> = Promise.resolve(null);

  /** Cached API client - recreated when auth changes */
  private apiClient: TRPCClient<AppRouter> | null = null;

  /** Files modified per agent instance - used to collect LSP diagnostics */
  private modifiedFilesPerAgent: Map<AgentInstanceId, Set<string>> = new Map();

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
    );
    await instance.initialize();
    return instance;
  }

  /**
   * Set the client runtime for workspace operations.
   * Call this when a workspace is opened/changed.
   * This will also create/recreate the LSP service.
   */
  public setClientRuntime(clientRuntime: ClientRuntimeNode | null): void {
    this.clientRuntime = clientRuntime;

    // Clear modified files tracking when workspace changes
    this.modifiedFilesPerAgent.clear();

    // Teardown old LspService and create new one with the new clientRuntime
    void this.lspService?.teardown();
    this.lspService = null;

    if (clientRuntime) {
      // Store the promise so LSP sync operations can await readiness
      this.lspReady = LspService.create(this.logger, clientRuntime)
        .then((lsp) => {
          this.lspService = lsp;
          this.logger.debug('[ToolboxService] LspService created');
          return lsp;
        })
        .catch((error) => {
          this.logger.error('[ToolboxService] Failed to create LspService', {
            error,
          });
          this.telemetryService.captureException(error as Error);
          return null;
        });
    } else this.lspReady = Promise.resolve(null);
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
      runtime: ClientRuntimeNode,
    ) => Promise<unknown>,
    agentInstanceId: string,
  ) {
    // Cast to any to bypass AI SDK's strict FlexibleSchema type inference
    // The schemas are validated Zod schemas that work correctly at runtime
    return tool({
      description,
      inputSchema: inputSchema as z.ZodType<TParams>,
      execute: async (params, options) => {
        const { toolCallId } = options as { toolCallId: string };
        const { relative_path: relativePath } = params as TParams;
        const absolutePath =
          this.clientRuntime!.fileSystem.resolvePath(relativePath);

        const beforeState = await captureFileState(absolutePath, this.tempDir);
        // Execute the actual tool
        const result = await executeFn(params, this.clientRuntime!);
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
            void this.syncFileWithLsp(absolutePath, editContent.contentAfter);
          // File deleted - close in LSP to clear diagnostics
          else if (
            !editContent.isExternal &&
            editContent.contentBefore !== null
          )
            void this.syncFileCloseWithLsp(absolutePath);

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
          this.telemetryService.captureException(error as Error);
          // Don't fail the tool execution if diff-history registration fails
        }

        // Track modified file for LSP diagnostics
        const modifiedFiles = this.modifiedFilesPerAgent.get(agentInstanceId);
        if (modifiedFiles) modifiedFiles.add(absolutePath);

        return result;
      },
    });
  }

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
  public async getTool<TToolName extends keyof UITools>(
    tool: TToolName,
    agentInstanceId: string,
  ): Promise<UITools[TToolName]> {
    if (!this.modifiedFilesPerAgent.has(agentInstanceId))
      this.modifiedFilesPerAgent.set(agentInstanceId, new Set());

    switch (tool) {
      case 'deleteFileTool':
        return this.wrapFileModifyingTool(
          DELETE_FILE_DESCRIPTION,
          deleteFileToolInputSchema,
          deleteFileToolExecute,
          agentInstanceId,
        ) as unknown as UITools[TToolName];
      case 'globTool':
        return globTool(this.clientRuntime!) as unknown as UITools[TToolName];
      case 'grepSearchTool':
        return grepSearchTool(
          this.clientRuntime!,
        ) as unknown as UITools[TToolName];
      case 'listFilesTool':
        return listFilesTool(
          this.clientRuntime!,
        ) as unknown as UITools[TToolName];
      case 'multiEditTool':
        return this.wrapFileModifyingTool(
          MULTI_EDIT_DESCRIPTION,
          multiEditToolInputSchema,
          multiEditToolExecute,
          agentInstanceId,
        ) as unknown as UITools[TToolName];
      case 'overwriteFileTool':
        return this.wrapFileModifyingTool(
          OVERWRITE_FILE_DESCRIPTION,
          overwriteFileToolInputSchema,
          overwriteFileToolExecute,
          agentInstanceId,
        ) as unknown as UITools[TToolName];
      case 'readFileTool':
        return readFileTool(
          this.clientRuntime!,
        ) as unknown as UITools[TToolName];
      case 'resolveContext7LibraryTool':
        return resolveContext7LibraryTool(
          this.apiClient as TRPCClient<AppRouter>,
        ) as unknown as UITools[TToolName];
      case 'getContext7LibraryDocsTool':
        return getContext7LibraryDocsTool(
          this.apiClient as TRPCClient<AppRouter>,
        ) as unknown as UITools[TToolName];
      case 'getLintingDiagnosticsTool':
        return getLintingDiagnosticsTool(
          this.lspService!,
          this.modifiedFilesPerAgent.get(agentInstanceId)!,
          this.clientRuntime!,
        ) as unknown as UITools[TToolName];
      case 'executeConsoleScriptTool':
        return executeConsoleScriptTool(
          this.windowLayoutService!,
        ) as unknown as UITools[TToolName];
      case 'readConsoleLogsTool':
        return readConsoleLogsTool(
          this.windowLayoutService!,
        ) as unknown as UITools[TToolName];
      default:
        throw new Error(`Tool "${String(tool)}" not found`);
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
        return null;
      }
    }

    return this.apiClient;
  }

  /**
   * Update a file's content in all applicable LSP servers.
   * Call this after a file is modified by a tool.
   * Waits for LSP service to be ready before syncing.
   */
  private async syncFileWithLsp(
    filePath: string,
    content: string,
  ): Promise<void> {
    // Wait for LSP to be ready before syncing
    const lsp = await this.lspReady;
    if (!lsp) return;

    try {
      await lsp.touchFile(filePath);
      await lsp.updateFile(filePath, content);
    } catch (err) {
      this.logger.debug('[ToolboxService] Failed to sync file with LSP', {
        error: err,
        path: filePath,
      });
    }
  }

  /**
   * Close a file in all applicable LSP servers.
   * Call this after a file is deleted by a tool.
   * Waits for LSP service to be ready before closing.
   */
  private async syncFileCloseWithLsp(filePath: string): Promise<void> {
    // Wait for LSP to be ready before closing
    const lsp = await this.lspReady;
    if (!lsp) return;

    try {
      await lsp.closeFile(filePath);
    } catch (err) {
      this.logger.debug('[ToolboxService] Failed to close file in LSP', {
        error: err,
        path: filePath,
      });
    }
  }

  /**
   * Refresh the API client (e.g., after auth state changes).
   * Call this when the auth token is refreshed.
   */
  public refreshApiClient(): void {
    this.apiClient = this.getOrCreateApiClient();
  }

  /**
   * Clear tracking data for a specific agent instance.
   * Call this when an agent session ends.
   */
  public clearAgentTracking(agentInstanceId: string): void {
    this.modifiedFilesPerAgent.delete(agentInstanceId);
  }

  private async initialize(): Promise<void> {
    this.logger.debug('[ToolboxService] Initializing...');
    this.authService.registerAuthStateChangeCallback(this.refreshApiClient);
  }

  protected onTeardown(): Promise<void> | void {
    this.apiClient = null;
    this.clientRuntime = null;

    // Teardown LSP service
    void this.lspService?.teardown();
    this.lspService = null;

    // Clear modified files tracking
    this.modifiedFilesPerAgent.clear();

    return Promise.resolve();
  }
}
