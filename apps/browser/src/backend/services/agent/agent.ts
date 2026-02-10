import type { ClientRuntime } from '@stagewise/agent-runtime-interface';
import path from 'node:path';
import { type Client, createClient } from '@libsql/client';
import { migrateDatabase } from '../../utils/migrate-database';
import { registry, schemaVersion } from './migrations';
import * as schema from './schema';
import initSql from './schema.sql?raw';
import { getArbitraryModel, getModelOptions } from './utils/get-model-settings';
import type { ModelId } from '@shared/available-models';
import type { GlobalDataPathService } from '../global-data-path';
import { isContextLimitError } from './utils/is-context-limit-error';
import { generateStagewiseMd } from './generate-stagewise-md';
import type { KartonService } from '../karton';
import type { Logger } from '../logger';
import type { TelemetryService } from '../telemetry';
import type { GlobalConfigService } from '../global-config';
import type { AuthService, AuthState } from '../auth';
import { hasDiffMetadata } from '@stagewise/agent-types';
import type { WindowLayoutService } from '../window-layout';
import {
  type KartonContract,
  type History,
  type ChatMessage,
  type QueuedMessage,
  AgentErrorType,
} from '@shared/karton-contracts/ui';
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic';
import {
  codingAgentTools,
  toolsWithoutExecute,
  noWorkspaceConfiguredAgentTools,
  type AgentToolsContext,
  type BrowserRuntime,
  type LintingDiagnosticsResult,
  type LintingDiagnostic,
} from '@stagewise/agent-tools';
import {
  streamText,
  smoothStream, // Disabled due to ai-sdk v6 bug - see usage comment
  generateId,
  readUIMessageStream,
  NoSuchToolError,
  generateText,
} from 'ai';
import type { AppRouter, TRPCClient } from '@stagewise/api-client';
import type { AsyncIterableStream, InferUIMessageChunk, ToolUIPart } from 'ai';
import {
  PromptBuilder,
  ORIGINAL_USER_MESSAGES_KEPT_WHEN_SUMMARIZING,
  findEndOfFirstNPairs,
} from './prompt-builder';
import { summarizeChatHistory } from './prompt-builder/utils/summarize-chat-history';
import { TimeoutManager } from './utils/time-out-manager';
import { createAuthenticatedClient } from './utils/create-authenticated-client';
import {
  findPendingToolCalls,
  type KartonStateProvider,
  attachToolOutputToMessage,
} from './utils/karton-helpers';
import type { GenericToolCallResult } from './utils/tool-call-utils';
import { createAndActivateNewChat } from './utils/karton-helpers';
import { extractStructuredError } from './utils/error-utils';
import { isAbortError } from './utils/is-abort-error';
import { isPlanLimitsExceededError } from './utils/is-plan-limit-error';
import type { PlanLimitsExceededError } from './utils/is-plan-limit-error';
import { processToolCalls } from './utils/tool-call-utils';
import { generateChatTitle } from './utils/generate-chat-title';
import { isAuthenticationError } from './utils/is-authentication-error';
import { ClientRuntimeNode } from '@stagewise/agent-runtime-node';
import { LspService } from '../workspace/services/lsp';
import type { DiagnosticsByFile } from './prompt-builder';
import { availableModels } from '@shared/available-models';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import {
  insertChat,
  updateChatTitle,
  updateChatTimestamp,
  updateChatModelId,
  getMostRecentChatModelId,
  getChatDetails,
  updateChatDraftInput,
  deleteChat as deleteChatFromDb,
  getChatSummaries,
  getChatCount,
  insertMessage,
  getMessagesForChat,
  deleteMessagesFromIndex,
} from './utils/db';
import { toWebKitTimestamp } from '../chrome-db-utils';

type ToolCallType = 'dynamic-tool' | `tool-${string}`;

const SCRIPT_EXECUTION_TIMEOUT_MS = 5000;

function getMinimalBrowserRuntime(
  windowLayoutService: WindowLayoutService,
): BrowserRuntime {
  return {
    executeScript: async (script, tabId) => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Script execution timed out after 5 seconds'));
        }, SCRIPT_EXECUTION_TIMEOUT_MS);
      });

      const result = await Promise.race([
        windowLayoutService.executeConsoleScript(script, tabId),
        timeoutPromise,
      ]);

      if (!result.success) throw new Error(result.error);
      // If the result is already a string (e.g., agent used JSON.stringify in script),
      // return it as-is to avoid double-stringification
      if (typeof result.result === 'string') return result.result;

      return JSON.stringify(result.result);
    },
    getConsoleLogs: (tabId, options) => {
      return windowLayoutService.getConsoleLogs(tabId, options);
    },
  };
}

function isToolCallType(type: string): type is ToolCallType {
  return type === 'dynamic-tool' || type.startsWith('tool-');
}

type ChatId = string;
type FilePath = string;

// Configuration constants
const DEFAULT_AGENT_TIMEOUT = 180000; // 3 minutes
const MAX_RECURSION_DEPTH = 50;

export class AgentService {
  private logger: Logger;
  private telemetryService: TelemetryService;
  private uiKarton: KartonService;
  private globalConfigService: GlobalConfigService;
  private windowLayoutService: WindowLayoutService;
  private authService: AuthService;
  private clientRuntime: ClientRuntime | null = null;
  private apiKey: string | null = null;
  private promptBuilder: PromptBuilder;
  private globalDataPathService: GlobalDataPathService;
  private client!: TRPCClient<AppRouter>;
  private isWorking = false;
  private timeoutManager: TimeoutManager;
  private recursionDepth = 0;
  private agentTimeout: number = DEFAULT_AGENT_TIMEOUT;
  private authRetryCount = 0;
  private maxAuthRetries = 2;
  private abortController: AbortController;
  private lastMessageId: string | null = null;
  private isWarmedUp = false;
  private thinkingDurationsPerChat: Map<
    ChatId,
    { durations: number[]; currentStartTime: number | null }
  > = new Map();
  private rejectedEditsPerChat: Map<ChatId, Set<FilePath>> = new Map();
  private thinkingEnabled = true;
  private isCompacting = false; // Guard to prevent concurrent compaction attempts
  private lspService: LspService | null = null;
  /** Files modified per chat - used to collect LSP diagnostics */
  private modifiedFilesPerChat: Map<ChatId, Set<string>> = new Map();
  private dbDriver: Client;
  private db: LibSQLDatabase<typeof schema>;

  // Current turn state tracking for early abort detection
  /** Whether any tool has produced a result in the current turn */
  private currentTurnHasToolResult = false;
  /** Total text content length generated in the current turn (excluding reasoning) */
  private currentTurnTextLength = 0;
  /** Whether the agent is currently in thinking/reasoning mode */
  private currentTurnIsThinking = false;

  private constructor(
    logger: Logger,
    telemetryService: TelemetryService,
    uiKarton: KartonService,
    globalConfigService: GlobalConfigService,
    authService: AuthService,
    windowLayoutService: WindowLayoutService,
    globalDataPathService: GlobalDataPathService,
  ) {
    this.logger = logger;
    this.telemetryService = telemetryService;
    this.uiKarton = uiKarton;
    this.globalConfigService = globalConfigService;
    this.windowLayoutService = windowLayoutService;
    this.authService = authService;
    this.globalDataPathService = globalDataPathService;
    const dbPath = path.join(globalDataPathService.globalDataPath, 'Agent');
    this.dbDriver = createClient({ url: `file:${dbPath}`, intMode: 'bigint' });
    this.db = drizzle(this.dbDriver, { schema });

    // Initialize prompt builder with state getter to ensure fresh state on each conversion
    this.promptBuilder = new PromptBuilder(
      this.clientRuntime,
      () => this.uiKarton.state,
      this.uiKarton.state.workspace?.paths.data ?? null,
    );

    // Initialize timeout manager
    this.timeoutManager = new TimeoutManager();

    // Initialize abort controller
    this.abortController = new AbortController();
    this.abortController.signal.addEventListener(
      'abort',
      () => {
        const activeChatId = this.uiKarton.state.agentChat?.activeChat?.id;
        if (!activeChatId) return;

        this.cleanupPendingOperations(
          'Agent call aborted',
          false,
          activeChatId,
        );
      },
      { once: true },
    );
  }

  private getToolsContext(): AgentToolsContext | null {
    if (!this.clientRuntime) {
      return {
        mode: 'no-workspace',
        tools: noWorkspaceConfiguredAgentTools(
          this.client,
          getMinimalBrowserRuntime(this.windowLayoutService),
        ),
      };
    }

    return {
      mode: 'coding',
      tools: codingAgentTools(
        this.clientRuntime,
        getMinimalBrowserRuntime(this.windowLayoutService),
        this.client,
        {
          onUpdateStagewiseMd: ({ reason }) =>
            this.updateStagewiseMd({ reason }),
          getLintingDiagnostics: () => this.getStructuredLintingDiagnostics(),
        },
      ),
    };
  }

  /**
   * Get structured linting diagnostics for modified files.
   * Used by the getLintingDiagnosticsTool.
   */
  private async getStructuredLintingDiagnostics(): Promise<LintingDiagnosticsResult> {
    const activeChatId = this.uiKarton.state.agentChat?.activeChat?.id;
    if (!activeChatId) {
      return {
        files: [],
        summary: {
          totalFiles: 0,
          totalIssues: 0,
          errors: 0,
          warnings: 0,
          infos: 0,
          hints: 0,
        },
      };
    }

    // Wait briefly for LSP servers to finish analyzing
    // TypeScript and ESLint can take a few hundred ms to report diagnostics
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Collect current diagnostics from LSP servers
    const diagnosticsByFile =
      await this.collectDiagnosticsForModifiedFiles(activeChatId);

    const agentAccessPath = this.clientRuntime
      ? this.clientRuntime.fileSystem.getCurrentWorkingDirectory()
      : '';

    // Build structured result
    const files: LintingDiagnosticsResult['files'] = [];

    let totalErrors = 0;
    let totalWarnings = 0;
    let totalInfos = 0;
    let totalHints = 0;

    for (const [filePath, aggregatedDiagnostics] of diagnosticsByFile) {
      const relativePath = filePath.startsWith(agentAccessPath)
        ? filePath.slice(agentAccessPath.length).replace(/^\//, '')
        : filePath;

      const fileDiagnostics: LintingDiagnostic[] = [];

      for (const { serverID, diagnostic } of aggregatedDiagnostics) {
        const severity = (diagnostic.severity ?? 1) as 1 | 2 | 3 | 4;
        fileDiagnostics.push({
          line: diagnostic.range.start.line + 1,
          column: diagnostic.range.start.character + 1,
          severity,
          source: diagnostic.source ?? serverID,
          message: diagnostic.message,
          // Convert code to string for AI SDK type validation compatibility
          code:
            diagnostic.code !== undefined ? String(diagnostic.code) : undefined,
        });

        if (severity === 1) totalErrors++;
        else if (severity === 2) totalWarnings++;
        else if (severity === 3) totalInfos++;
        else if (severity === 4) totalHints++;
      }

      if (fileDiagnostics.length > 0)
        files.push({ path: relativePath, diagnostics: fileDiagnostics });
    }

    const totalIssues = totalErrors + totalWarnings + totalInfos + totalHints;

    return {
      files,
      summary: {
        totalFiles: files.length,
        totalIssues,
        errors: totalErrors,
        warnings: totalWarnings,
        infos: totalInfos,
        hints: totalHints,
      },
    };
  }

  private async initializeClient() {
    // await this.authService.refreshAuthState();
    const accessToken = this.authService.accessToken;
    if (!accessToken) {
      this.logger.debug(
        '[AgentService] No authentication tokens available. Initializing client failed, please sign in before using the agent.',
      );
      return;
    }

    this.apiKey = accessToken;
    this.client = createAuthenticatedClient(this.apiKey);
  }

  private async updateStagewiseMd({ reason }: { reason: string }) {
    if (!this.clientRuntime) return;
    if (!this.uiKarton.state.workspace?.paths.data) return;
    if (!this.apiKey) {
      this.logger.debug(
        '[AgentService] No API key available. Initializing client failed, please sign in before using the agent.',
      );
      return;
    }
    const haikuOptions = getModelOptions('claude-haiku-4-5', this.apiKey);
    const posthogTraceId = generateId();
    const optionsWithTracing = {
      model: this.telemetryService.withTracing(haikuOptions.model, {
        posthogTraceId,
        posthogProperties: {
          $ai_span_name: 'update-stagewise-md',
          posthogTraceId,
          modelId: haikuOptions.model.modelId,
        },
      }),
      providerOptions: haikuOptions.providerOptions,
      headers: haikuOptions.headers,
    };

    const stagewiseMdPath = this.uiKarton.state.workspace?.paths.data;
    if (!stagewiseMdPath) return;

    void generateStagewiseMd(
      optionsWithTracing,
      this.clientRuntime!,
      new ClientRuntimeNode({
        workingDirectory: stagewiseMdPath,
        rgBinaryBasePath: this.globalDataPathService.globalDataPath,
      }),
      reason,
    );
  }

  public setClientRuntime(clientRuntime: ClientRuntime | null): void {
    this.clientRuntime = clientRuntime;
    this.promptBuilder = new PromptBuilder(
      this.clientRuntime,
      () => this.uiKarton.state,
      this.uiKarton.state.workspace?.paths.data ?? null,
    );

    // Clear modified files tracking when workspace changes
    this.modifiedFilesPerChat.clear();

    // Teardown old LspService and create new one with the new clientRuntime
    void this.lspService?.teardown();
    this.lspService = null;

    if (clientRuntime) {
      LspService.create(this.logger, clientRuntime)
        .then((lsp) => {
          this.lspService = lsp;
          this.logger.debug('[AgentService] LspService created');
        })
        .catch((error) => {
          this.logger.error(
            '[AgentService] Failed to create LspService',
            error,
          );
          this.telemetryService.captureException(error as Error);
        });
    }
  }

  public async sendUserMessage(message: ChatMessage): Promise<void> {
    this.logger.debug('[AgentService] Sending user message');
    const activeChatId = this.uiKarton.state.agentChat?.activeChat?.id;
    if (!activeChatId) return;

    // If agent is currently working, queue the message for later processing
    if (this.isWorking) {
      this.logger.debug(
        '[AgentService] Agent is working, queueing message instead',
      );
      this.queueMessage(message, activeChatId);
      return;
    }

    // Reset thinking durations for this chat (new user message = new turn)
    this.thinkingDurationsPerChat.set(activeChatId, {
      durations: [],
      currentStartTime: null,
    });
    // Set thinking 'enabled' based on workspace status. IMPORTANT: Thinking mode must not be switched immediately after tool-responses!
    if (
      this.uiKarton.state.workspaceStatus === 'open' &&
      this.thinkingEnabled === false
    )
      this.thinkingEnabled = true;

    const pendingToolCalls = findPendingToolCalls(
      this.uiKarton as KartonStateProvider<KartonContract['state']>,
      activeChatId,
    );
    // User-Interaction tool calls could still have open inputs - cancel them
    if (pendingToolCalls.length > 0) {
      pendingToolCalls.forEach(({ toolCallId }) => {
        attachToolOutputToMessage(
          this.uiKarton as KartonStateProvider<KartonContract['state']>,
          [
            {
              toolCallId,
              duration: 0,
              error: {
                message: 'Tool execution skipped by user',
              },
            },
          ],
          this.lastMessageId!,
        );
      });
    }

    this.setAgentWorking(true);

    const newstate = this.uiKarton.setState((draft) => {
      const chat = draft.agentChat?.activeChat;
      if (chat) {
        chat.messages.push({
          ...message,
          metadata: {
            ...message.metadata,
            rejectedEdits: Array.from(
              this.rejectedEditsPerChat.get(activeChatId) ?? [],
            ),
          },
        } as any);
        chat.error = undefined;
        this.rejectedEditsPerChat.delete(activeChatId);
      }
    });

    const messages = newstate?.agentChat?.activeChat?.messages;
    const messageIndex = (messages?.length ?? 1) - 1;

    // Persist user message to SQLite
    try {
      await insertMessage(this.db, {
        id: message.id,
        chatId: activeChatId,
        messageIndex,
        content: message,
      });
      // Update chat timestamp in DB and memory
      await this.updateChatLastModified(activeChatId);
    } catch (error) {
      this.logger.error('[AgentService] Failed to persist user message', {
        error,
        chatId: activeChatId,
        messageId: message.id,
      });
    }

    this.logger.debug('[AgentService] Calling agent');

    await this.callAgent({
      chatId: activeChatId,
      history: messages,
    });
  }

  /**
   * Queue a message to be sent when the agent finishes working.
   * Used when user sends a message while the agent is busy.
   */
  private queueMessage(message: ChatMessage, chatId: string): void {
    this.logger.debug('[AgentService] Queueing message for later', { chatId });

    const queuedMessage: QueuedMessage = {
      id: generateId(),
      message,
      queuedAt: new Date(),
    };

    this.uiKarton.setState((draft) => {
      if (!draft.agentChat) return;

      // Initialize queue for this chat if it doesn't exist
      if (!draft.agentChat.messageQueue[chatId])
        draft.agentChat.messageQueue[chatId] = [];

      draft.agentChat.messageQueue[chatId].push(queuedMessage as any);
    });

    this.telemetryService.capture('agent-message-queued', {
      chat_id: chatId,
      queue_size:
        (this.uiKarton.state.agentChat?.messageQueue[chatId]?.length ?? 0) + 1,
    });
  }

  /**
   * Process the next queued message for the active chat, if any.
   * Called after the agent finishes working.
   */
  private async processNextQueuedMessage(): Promise<void> {
    const activeChatId = this.uiKarton.state.agentChat?.activeChat?.id;
    if (!activeChatId) return;

    // Check if queue is paused for this chat (e.g., after an error)
    const isPaused =
      this.uiKarton.state.agentChat?.queuePausedChats[activeChatId];
    if (isPaused) {
      this.logger.debug(
        '[AgentService] Queue is paused for chat, skipping processing',
        { chatId: activeChatId },
      );
      return;
    }

    const queue = this.uiKarton.state.agentChat?.messageQueue[activeChatId];
    if (!queue || queue.length === 0) return;

    // Dequeue the first message
    const queuedMessage = queue[0];
    if (!queuedMessage) return;

    this.logger.debug('[AgentService] Processing queued message', {
      chatId: activeChatId,
      queuedMessageId: queuedMessage.id,
      remainingInQueue: queue.length - 1,
    });

    // Remove from queue
    this.uiKarton.setState((draft) => {
      if (!draft.agentChat) return;
      const chatQueue = draft.agentChat.messageQueue[activeChatId];
      if (chatQueue && chatQueue.length > 0) {
        chatQueue.shift();
      }
    });

    this.telemetryService.capture('agent-queued-message-processing', {
      chat_id: activeChatId,
      queued_message_id: queuedMessage.id,
      time_in_queue_ms: Date.now() - new Date(queuedMessage.queuedAt).getTime(),
    });

    // Send the message (this will set isWorking to true and call the agent)
    await this.sendUserMessage(queuedMessage.message);
  }

  /**
   * Pause the message queue for a specific chat.
   * Called when an error occurs to prevent auto-sending more messages.
   */
  private pauseMessageQueue(chatId: string): void {
    this.logger.debug('[AgentService] Pausing message queue for chat', {
      chatId,
    });
    this.uiKarton.setState((draft) => {
      if (draft.agentChat) {
        draft.agentChat.queuePausedChats[chatId] = true;
      }
    });
  }

  /**
   * Resume the message queue for a specific chat and process next message.
   * Called by the user to continue after an error.
   */
  private resumeMessageQueueForChat(chatId: string): void {
    this.logger.debug('[AgentService] Resuming message queue for chat', {
      chatId,
    });
    this.uiKarton.setState((draft) => {
      if (draft.agentChat) {
        draft.agentChat.queuePausedChats[chatId] = false;
      }
    });

    // Process next queued message if any
    void this.processNextQueuedMessage();
  }

  /**
   * Abort current agent work and immediately send a specific queued message.
   * This removes the message from the queue, aborts any current work, and sends it.
   */
  private async sendQueuedMessageNow(
    chatId: string,
    queuedMessageId: string,
  ): Promise<void> {
    this.logger.debug('[AgentService] Sending queued message now', {
      chatId,
      queuedMessageId,
    });

    // Find and remove the queued message from state
    const queue = this.uiKarton.state.agentChat?.messageQueue[chatId];
    const queuedMessage = queue?.find((m) => m.id === queuedMessageId);

    if (!queuedMessage) {
      this.logger.warn('[AgentService] Queued message not found', {
        chatId,
        queuedMessageId,
      });
      return;
    }

    // Remove from queue
    this.uiKarton.setState((draft) => {
      if (!draft.agentChat) return;
      const chatQueue = draft.agentChat.messageQueue[chatId];
      if (chatQueue) {
        const index = chatQueue.findIndex((m) => m.id === queuedMessageId);
        if (index !== -1) chatQueue.splice(index, 1);
      }
    });

    // Abort current agent call if working
    if (this.isWorking) {
      this.logger.debug(
        '[AgentService] Aborting current agent call to send queued message',
      );
      this.abortAgentCall();
    }

    this.telemetryService.capture('agent-queued-message-sent-now', {
      chat_id: chatId,
      queued_message_id: queuedMessageId,
      time_in_queue_ms: Date.now() - new Date(queuedMessage.queuedAt).getTime(),
    });

    // Send the message immediately
    await this.sendUserMessage(queuedMessage.message);
  }

  public setCurrentWorkingDirectory(
    absoluteCurrentWorkingDirectory: string,
  ): void {
    this.clientRuntime?.fileSystem.setCurrentWorkingDirectory(
      absoluteCurrentWorkingDirectory,
    );
    this.promptBuilder = new PromptBuilder(
      this.clientRuntime,
      () => this.uiKarton.state,
      this.uiKarton.state.workspace?.paths.data ?? null,
    );

    // Recreate LspService with the new working directory as root
    if (this.clientRuntime) {
      void this.lspService?.teardown();
      this.lspService = null;

      LspService.create(this.logger, this.clientRuntime)
        .then((lsp) => {
          this.lspService = lsp;
          this.logger.debug(
            '[AgentService] LspService recreated with new working directory',
          );
        })
        .catch((error) => {
          this.logger.error(
            '[AgentService] Failed to recreate LspService',
            error,
          );
          this.telemetryService.captureException(error as Error);
        });
    }
  }

  public createAndActivateNewChat() {
    return createAndActivateNewChat(
      this.uiKarton as KartonStateProvider<KartonContract['state']>,
    );
  }

  /**
   * Creates a new chat with persistence to SQLite.
   * Updates both in-memory state and database.
   * @param draftContent - Optional TipTap JSON to save to OLD chat and transfer to new chat
   */
  private async createNewChatWithPersistence(
    draftContent?: string,
  ): Promise<string> {
    // Save draft to OLD chat before creating new one
    const oldChatId = this.uiKarton.state.agentChat?.activeChat?.id;
    if (oldChatId && draftContent !== undefined) {
      try {
        await updateChatDraftInput(this.db, oldChatId, draftContent || null);
      } catch (error) {
        this.logger.error(
          '[AgentService] Failed to save draft to old chat before creating new',
          { error, chatId: oldChatId },
        );
      }
    }

    const chatId = createAndActivateNewChat(
      this.uiKarton as KartonStateProvider<KartonContract['state']>,
    );

    const chat = this.uiKarton.state.agentChat?.activeChat;
    if (!chat) return chatId;

    const now = new Date();
    const nowTimestamp = toWebKitTimestamp(now);
    const modelId =
      this.uiKarton.state.agentChat?.selectedModel?.modelId ??
      availableModels[0].modelId;

    // Insert into SQLite with draft content transferred to new chat
    try {
      await insertChat(this.db, {
        id: chatId,
        title: chat.title,
        lastUsedModelId: modelId,
        createdAt: nowTimestamp,
        updatedAt: nowTimestamp,
        draftInputContent: draftContent || null,
      });

      // Prepend to chatList in state
      this.uiKarton.setState((draft) => {
        if (draft.agentChat) {
          draft.agentChat.chatList.unshift({
            id: chatId,
            title: chat.title,
            createdAt: now,
            updatedAt: now,
          });
          // Set the draft content on the activeChat so UI can restore it
          if (draft.agentChat.activeChat) {
            draft.agentChat.activeChat.draftInputContent =
              draftContent || undefined;
          }
        }
      });
    } catch (error) {
      this.logger.error('[AgentService] Failed to persist new chat', { error });
    }

    return chatId;
  }

  /**
   * Updates the chat's updatedAt timestamp in both the database and in-memory chatList.
   */
  private async updateChatLastModified(chatId: string): Promise<void> {
    const now = new Date();
    await updateChatTimestamp(this.db, chatId);
    this.uiKarton.setState((draft) => {
      if (draft.agentChat) {
        const chat = draft.agentChat.chatList.find((c) => c.id === chatId);
        if (chat) chat.updatedAt = now;
      }
    });
  }

  /**
   * Loads a chat's messages from SQLite into memory.
   * Sets the chat as active and populates the chats record.
   * Also restores the chat's last used model.
   */
  private async loadChatIntoMemory(chatId: string): Promise<void> {
    try {
      const messages = await getMessagesForChat(this.db, chatId);
      const chatSummary = this.uiKarton.state.agentChat?.chatList.find(
        (c) => c.id === chatId,
      );

      if (!chatSummary) {
        this.logger.warn(
          '[AgentService] Chat not found in chatList, creating new chat instead',
          { chatId },
        );
        await this.createNewChatWithPersistence();
        return;
      }

      // Fetch the chat's details (model and draft) from DB
      const chatDetails = await getChatDetails(this.db, chatId);
      const chatModel = chatDetails?.lastUsedModelId
        ? (availableModels.find(
            (m) => m.modelId === chatDetails.lastUsedModelId,
          ) ?? availableModels[0])
        : availableModels[0];

      // Extract messages content before setState to avoid type complexity
      const loadedMessages = messages.map((m) => m.content);

      this.uiKarton.setState((draft) => {
        if (!draft.agentChat) return;

        // Create the chat object with loaded messages and draft
        draft.agentChat.activeChat = {
          id: chatId,
          title: chatSummary.title,
          createdAt: chatSummary.createdAt,
          messages: loadedMessages as any,
          usage: { maxContextWindowSize: 200000, usedContextWindowSize: 0 },
          pendingEdits: [],
          draftInputContent: chatDetails?.draftInputContent ?? undefined,
        };

        // Restore the chat's model
        draft.agentChat.selectedModel = chatModel;
      });

      this.logger.debug('[AgentService] Loaded chat into memory', {
        chatId,
        messageCount: messages.length,
        modelId: chatModel.modelId,
        hasDraft: !!chatDetails?.draftInputContent,
      });
    } catch (error) {
      this.logger.error('[AgentService] Failed to load chat from DB', {
        error,
        chatId,
      });
      // Fallback: create a new chat
      await this.createNewChatWithPersistence();
    }
  }

  private setAgentWorking(isWorking: boolean): void {
    this.timeoutManager.clear('is-working');
    const wasWorking = this.isWorking;
    this.isWorking = isWorking;

    if (isWorking) {
      this.timeoutManager.set(
        'is-working',
        () => {
          this.setAgentWorking(false);
        },
        this.agentTimeout,
      );
    }

    this.uiKarton.setState((draft) => {
      if (draft.agentChat) {
        draft.agentChat.isWorking = isWorking;
      }
    });

    // Emit telemetry event
    this.telemetryService.capture('agent-state-changed', {
      isWorking,
      wasWorking,
    });
  }

  private cleanupPendingOperations(
    _reason?: string,
    resetRecursionDepth = true,
    chatId?: string,
    shouldProcessQueue = false,
  ): void {
    if (chatId && this.lastMessageId) {
      const pendingToolCalls = findPendingToolCalls(
        this.uiKarton as KartonStateProvider<KartonContract['state']>,
        chatId,
      );
      if (pendingToolCalls.length > 0) {
        const abortedResults: GenericToolCallResult[] = pendingToolCalls.map(
          ({ toolCallId }) => ({
            toolCallId,
            duration: 0,
            error: {
              message: 'Tool execution aborted by user',
            },
          }),
        );

        attachToolOutputToMessage(
          this.uiKarton as KartonStateProvider<KartonContract['state']>,
          abortedResults,
          this.lastMessageId,
        );
      }
    }

    this.timeoutManager.clearAll();

    if (resetRecursionDepth) this.recursionDepth = 0;

    this.setAgentWorking(false);

    // Process next queued message if requested (only on natural completion, not on abort/error)
    if (shouldProcessQueue) {
      // Successful completion clears any paused state from previous errors
      // This allows the queue to resume after user retries/resends successfully
      const activeChatId = this.uiKarton.state.agentChat?.activeChat?.id;
      if (activeChatId) {
        this.uiKarton.setState((draft) => {
          if (draft.agentChat)
            draft.agentChat.queuePausedChats[activeChatId] = false;
        });
      }
      void this.processNextQueuedMessage();
    }
  }

  private onAuthStateChange = (async (newAuthState: AuthState) => {
    if (newAuthState.status === 'authenticated') {
      this.logger.debug(
        '[AgentService] Auth state changed to authenticated, initializing client...',
      );
      await this.initializeClient();
      if (!this.isWarmedUp) {
        this.isWarmedUp = true;
        void this.warmUpLLMProxyCache();
      }
    }
  }).bind(this);

  public async initialize() {
    this.logger.debug('[AgentService] Initializing...');

    try {
      await migrateDatabase({
        db: this.db,
        client: this.dbDriver,
        registry,
        initSql,
        schemaVersion,
      });
    } catch (e) {
      this.logger.error('[AgentService] Failed to initialize', { error: e });
    }

    // Get the most recently used model from the most recent chat (or fallback)
    const mostRecentModelId = await getMostRecentChatModelId(this.db);
    const initialModel = mostRecentModelId
      ? (availableModels.find((m) => m.modelId === mostRecentModelId) ??
        availableModels[0])
      : availableModels[0];

    // Load initial chat summaries from SQLite
    const initialChatList = await getChatSummaries(this.db, 20, 0);
    const totalChatCount = await getChatCount(this.db);

    this.uiKarton.setState((draft) => {
      if (!draft.agentChat) {
        draft.agentChat = {
          activeChat: null,
          chatList: initialChatList,
          hasMoreChats: totalChatCount > 20,
          isWorking: false,
          selectedModel: initialModel,
          messageQueue: {},
          queuePausedChats: {},
        };
      }
    });

    // Initialize client
    await this.initializeClient();

    this.authService.registerAuthStateChangeCallback(this.onAuthStateChange);

    // Register all karton procedure handlers
    this.registerProcedureHandlers();

    // Fetch subscription
    await this.fetchSubscription();

    // Set initial state
    this.setAgentWorking(false);

    // Always start with a fresh new chat
    await this.createNewChatWithPersistence();

    this.logger.debug('[AgentService] Initialized');
  }

  private abortAgentCall(): {
    restored: boolean;
    userMessage?: ChatMessage;
  } {
    const activeChatId = this.uiKarton.state.agentChat?.activeChat?.id;
    if (!activeChatId) return { restored: false };

    // Check if this is an early abort (should restore user message to input)
    // Early abort conditions:
    // 1. Agent is still thinking and no tool has produced a result yet, OR
    // 2. No tool has produced a result AND less than 15 response characters generated
    const isEarlyAbort =
      (this.currentTurnIsThinking && !this.currentTurnHasToolResult) ||
      (!this.currentTurnHasToolResult && this.currentTurnTextLength < 15);

    let restoredMessage: ChatMessage | undefined;

    if (isEarlyAbort) {
      // Find the last user message to restore
      const chat = this.uiKarton.state.agentChat?.activeChat;
      const messages = chat?.messages ?? [];

      // Find the last user message
      let lastUserMessageIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          lastUserMessageIndex = i;
          break;
        }
      }

      if (lastUserMessageIndex !== -1) {
        // Store the user message for restoration
        restoredMessage = messages[lastUserMessageIndex] as ChatMessage;

        // Remove the user message and any messages after it (partial assistant response)
        this.uiKarton.setState((draft) => {
          const chat = draft.agentChat?.activeChat;
          if (chat)
            chat.messages = messages.slice(0, lastUserMessageIndex) as any;
        });

        // Delete truncated messages from SQLite (fire-and-forget)
        deleteMessagesFromIndex(
          this.db,
          activeChatId,
          lastUserMessageIndex,
        ).catch((error) => {
          this.logger.error(
            '[AgentService] Failed to delete early abort messages from DB',
            {
              error,
              chatId: activeChatId,
              fromIndex: lastUserMessageIndex,
            },
          );
        });

        this.logger.debug(
          '[AgentService] Early abort: restoring user message to input',
          { messageId: restoredMessage.id },
        );
      }
    }

    this.abortController.abort();
    this.abortController = new AbortController();
    this.abortController.signal.addEventListener(
      'abort',
      () => {
        const chatId = this.uiKarton.state.agentChat?.activeChat?.id;
        if (chatId) {
          this.cleanupPendingOperations('Agent call aborted', false, chatId);
        }
      },
      { once: true },
    );

    // Reset turn tracking variables
    this.currentTurnHasToolResult = false;
    this.currentTurnTextLength = 0;
    this.currentTurnIsThinking = false;

    return {
      restored: !!restoredMessage,
      userMessage: restoredMessage,
    };
  }

  private registerProcedureHandlers() {
    // Agent Chat procedures
    try {
      this.uiKarton.registerServerProcedureHandler(
        'agentChat.undoEditsUntilUserMessage',
        async (
          _callingClientId: string,
          userMessageId: string,
          chatId: string,
        ) => {
          await this.undoEditsUntilUserMessage(userMessageId, chatId);
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.setSelectedModel',
        async (_callingClientId: string, model: ModelId) => {
          const modelSettings = availableModels.find(
            (m) => m.modelId === model,
          );
          if (!modelSettings) return;
          this.uiKarton.setState((draft) => {
            if (draft.agentChat) draft.agentChat.selectedModel = modelSettings;
          });
          // Persist the selection to the active chat's DB record
          const activeChatId = this.uiKarton.state.agentChat?.activeChat?.id;
          if (activeChatId)
            await updateChatModelId(this.db, activeChatId, model);
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.acceptAllPendingEdits',
        async (_callingClientId: string) => {},
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.rejectAllPendingEdits',
        async (_callingClientId: string) => {},
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.acceptPendingEdit',
        async (_callingClientId: string, _filePath: string) => {},
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.rejectPendingEdit',
        async (_callingClientId: string, _filePath: string) => {},
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.retrySendingUserMessage',
        async (_callingClientId: string) => {
          this.setAgentWorking(true);
          const activeChatId = this.uiKarton.state.agentChat?.activeChat?.id;
          if (!activeChatId) return;

          this.uiKarton.setState((draft) => {
            const chat = draft.agentChat?.activeChat;
            if (chat) {
              chat.error = undefined;
            }
          });

          const messages = this.uiKarton.state.agentChat?.activeChat?.messages;
          await this.callAgent({
            chatId: activeChatId,
            history: messages,
          });

          this.setAgentWorking(false);
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.abortAgentCall',
        async (_callingClientId: string) => {
          return this.abortAgentCall();
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.approveToolCall',
        async (_callingClientId: string, _toolCallId: string) => {
          // Implementation TBD
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.rejectToolCall',
        async (_callingClientId: string, _toolCallId: string) => {
          // Implementation TBD
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.create',
        async (_callingClientId: string, draftContent?: string) => {
          return this.createNewChatWithPersistence(draftContent);
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.switch',
        async (
          _callingClientId: string,
          chatId: string,
          oldChatDraft?: string,
        ) => {
          const currentActiveChat = this.uiKarton.state.agentChat?.activeChat;

          // Don't do anything if switching to the same chat
          if (currentActiveChat?.id === chatId) return;

          // Clean up current chat if it's empty
          if (currentActiveChat && currentActiveChat.messages.length === 0) {
            // Delete empty chat from DB
            try {
              await deleteChatFromDb(this.db, currentActiveChat.id);
            } catch (error) {
              this.logger.error(
                '[AgentService] Failed to delete empty chat from DB',
                { error, chatId: currentActiveChat.id },
              );
            }
            // Remove from chatList
            this.uiKarton.setState((draft) => {
              if (draft.agentChat) {
                draft.agentChat.chatList = draft.agentChat.chatList.filter(
                  (c) => c.id !== currentActiveChat.id,
                );
              }
            });
          } else if (currentActiveChat) {
            // Save the draft to the OLD chat (if it's not being deleted)
            try {
              await updateChatDraftInput(
                this.db,
                currentActiveChat.id,
                oldChatDraft ?? null,
              );
            } catch (error) {
              this.logger.error(
                '[AgentService] Failed to save draft to old chat',
                { error, chatId: currentActiveChat.id },
              );
            }
          }

          // Load the new chat from DB
          await this.loadChatIntoMemory(chatId);
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.delete',
        async (_callingClientId: string, chatId: string) => {
          const activeChatId = this.uiKarton.state.agentChat?.activeChat?.id;
          if (this.isWorking) this.abortAgentCall();

          // Delete from SQLite first
          try {
            await deleteChatFromDb(this.db, chatId);
          } catch (error) {
            this.logger.error('[AgentService] Failed to delete chat from DB', {
              error,
              chatId,
            });
          }

          if (activeChatId === chatId) {
            // Find next chat from chatList (excluding the one being deleted)
            const chatList = this.uiKarton.state.agentChat?.chatList ?? [];
            const nextChat = chatList.find((c) => c.id !== chatId);

            if (!nextChat) {
              // No other chats exist - create a new one
              await this.createNewChatWithPersistence();
            } else {
              // Load the next chat
              await this.loadChatIntoMemory(nextChat.id);
            }
          }

          // Clean up per-chat data structures
          this.modifiedFilesPerChat.delete(chatId);
          this.thinkingDurationsPerChat.delete(chatId);

          this.uiKarton.setState((draft) => {
            // Remove from chatList
            if (draft.agentChat) {
              draft.agentChat.chatList = draft.agentChat.chatList.filter(
                (c) => c.id !== chatId,
              );
            }
            // Clean up message queue and paused state for deleted chat
            if (draft.agentChat?.messageQueue[chatId])
              delete draft.agentChat.messageQueue[chatId];
            if (draft.agentChat?.queuePausedChats[chatId])
              delete draft.agentChat.queuePausedChats[chatId];
          });
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.sendUserMessage',
        async (_callingClientId: string, message: ChatMessage) => {
          await this.sendUserMessage(message);
        },
      );

      // Message queue procedures
      this.uiKarton.registerServerProcedureHandler(
        'agentChat.queueUserMessage',
        async (_callingClientId: string, message: ChatMessage) => {
          const activeChatId = this.uiKarton.state.agentChat?.activeChat?.id;
          if (!activeChatId) return;
          this.queueMessage(message, activeChatId);
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.removeQueuedMessage',
        async (
          _callingClientId: string,
          chatId: string,
          queuedMessageId: string,
        ) => {
          this.uiKarton.setState((draft) => {
            if (!draft.agentChat) return;
            const queue = draft.agentChat.messageQueue[chatId];
            if (queue) {
              const index = queue.findIndex((m) => m.id === queuedMessageId);
              if (index !== -1) {
                queue.splice(index, 1);
              }
            }
          });
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.clearMessageQueue',
        async (_callingClientId: string, chatId: string) => {
          this.uiKarton.setState((draft) => {
            if (!draft.agentChat) return;
            draft.agentChat.messageQueue[chatId] = [];
          });
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.resumeMessageQueue',
        async (_callingClientId: string, chatId: string) => {
          this.resumeMessageQueueForChat(chatId);
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.sendQueuedMessageNow',
        async (
          _callingClientId: string,
          chatId: string,
          queuedMessageId: string,
        ) => {
          await this.sendQueuedMessageNow(chatId, queuedMessageId);
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.loadMoreChats',
        async (_callingClientId: string) => {
          const currentCount =
            this.uiKarton.state.agentChat?.chatList.length ?? 0;
          const moreChats = await getChatSummaries(this.db, 10, currentCount);
          const totalChats = await getChatCount(this.db);

          this.uiKarton.setState((draft) => {
            if (draft.agentChat) {
              draft.agentChat.chatList.push(...moreChats);
              draft.agentChat.hasMoreChats =
                currentCount + moreChats.length < totalChats;
            }
          });

          return {
            loaded: moreChats.length,
            hasMore: currentCount + moreChats.length < totalChats,
          };
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.submitUserInteractionToolInput',
        async (_callingClientId: string, toolCallId, input) => {
          const { type: _, ...cleanInput } = input;
          // Find tool call with state 'input-available' and the toolCallId and attach the output
          attachToolOutputToMessage(
            this.uiKarton as KartonStateProvider<KartonContract['state']>,
            [
              {
                toolCallId,
                result: cleanInput,
                duration: 0,
              },
            ],
            this.lastMessageId!,
          );
          const pendingToolCalls = findPendingToolCalls(
            this.uiKarton as KartonStateProvider<KartonContract['state']>,
            this.uiKarton.state.agentChat?.activeChat?.id!,
          );
          if (pendingToolCalls.length > 0) return { success: true }; // Other tool calls are still pending - only call agent on the last submission
          this.setAgentWorking(true);
          this.callAgent({
            chatId: this.uiKarton.state.agentChat?.activeChat?.id!,
            history: this.uiKarton.state.agentChat?.activeChat?.messages,
          });
          return { success: true };
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'agentChat.cancelUserInteractionToolInput',
        async (_callingClientId: string, toolCallId: string) => {
          attachToolOutputToMessage(
            this.uiKarton as KartonStateProvider<KartonContract['state']>,
            [
              {
                toolCallId,
                duration: 0,
                error: {
                  message: 'Tool execution cancelled by user',
                },
              },
            ],
            this.lastMessageId!,
          );
          this.setAgentWorking(true);
          this.callAgent({
            chatId: this.uiKarton.state.agentChat?.activeChat?.id!,
            history: this.uiKarton.state.agentChat?.activeChat?.messages,
          });
        },
      );

      this.uiKarton.registerServerProcedureHandler(
        'userAccount.refreshSubscription',
        async (_callingClientId: string) => {
          await this.fetchSubscription();
        },
      );
    } catch (error) {
      this.logger.debug(
        `[AgentService] Failed to register server procedure handlers ${error}`,
        {
          cause: error,
        },
      );
    }
  }

  private removeServerProcedureHandlers() {
    this.uiKarton.removeServerProcedureHandler(
      'agentChat.undoEditsUntilUserMessage',
    );
    this.uiKarton.removeServerProcedureHandler('agentChat.setSelectedModel');
    this.uiKarton.removeServerProcedureHandler(
      'agentChat.acceptAllPendingEdits',
    );
    this.uiKarton.removeServerProcedureHandler(
      'agentChat.rejectAllPendingEdits',
    );
    this.uiKarton.removeServerProcedureHandler('agentChat.acceptPendingEdit');
    this.uiKarton.removeServerProcedureHandler('agentChat.rejectPendingEdit');
    this.uiKarton.removeServerProcedureHandler(
      'agentChat.submitUserInteractionToolInput',
    );
    this.uiKarton.removeServerProcedureHandler(
      'agentChat.cancelUserInteractionToolInput',
    );
    this.uiKarton.removeServerProcedureHandler(
      'agentChat.retrySendingUserMessage',
    );
    this.uiKarton.removeServerProcedureHandler('agentChat.abortAgentCall');
    this.uiKarton.removeServerProcedureHandler('agentChat.approveToolCall');
    this.uiKarton.removeServerProcedureHandler('agentChat.rejectToolCall');
    this.uiKarton.removeServerProcedureHandler('agentChat.create');
    this.uiKarton.removeServerProcedureHandler('agentChat.switch');
    this.uiKarton.removeServerProcedureHandler('agentChat.delete');
    this.uiKarton.removeServerProcedureHandler('agentChat.sendUserMessage');
    // Message queue procedures
    this.uiKarton.removeServerProcedureHandler('agentChat.queueUserMessage');
    this.uiKarton.removeServerProcedureHandler('agentChat.removeQueuedMessage');
    this.uiKarton.removeServerProcedureHandler('agentChat.clearMessageQueue');
    this.uiKarton.removeServerProcedureHandler('agentChat.resumeMessageQueue');
    this.uiKarton.removeServerProcedureHandler(
      'agentChat.sendQueuedMessageNow',
    );
    this.uiKarton.removeServerProcedureHandler('agentChat.loadMoreChats');
    this.uiKarton.removeServerProcedureHandler(
      'userAccount.refreshSubscription',
    );
  }

  private async fetchSubscription() {
    try {
      const subscription =
        await this.client.subscription.getSubscription.query();
      this.uiKarton.setState((draft) => {
        if (draft.userAccount) {
          draft.userAccount.subscription = {
            ...subscription,
            active: subscription.hasSubscription,
          };
        }
      });
    } catch (error) {
      this.logger.debug('[AgentService] Failed to fetch subscription', error);
    }
  }

  private async callAgent({
    chatId,
    history,
  }: {
    chatId: string;
    history?: History;
  }): Promise<void> {
    const captureAgentError = (scope: string) => {
      this.telemetryService.captureException(
        new Error(
          `Agent call failed. [${scope}] failed, please check if you are signed in and try again.`,
        ),
      );
      this.logger.debug(
        `[AgentService] Agent call failed. [${scope}] failed, please check if you are signed in and try again.`,
      );
      return;
    };
    if (!this.apiKey) return captureAgentError('No API key available');

    const toolsContext = this.getToolsContext();
    if (!toolsContext) {
      // agent without workspace configured won't use any tools
      this.logger.debug(
        "[AgentService] Tools are null, agent without workspace configured won't use any tools",
      );
    }

    if (!this.modifiedFilesPerChat.has(chatId))
      this.modifiedFilesPerChat.set(chatId, new Set());

    // If the LLM proxy cache is not warmed up yet, this agent request acts as a warm-up request
    if (!this.isWarmedUp) this.isWarmedUp = true;

    if (this.recursionDepth >= MAX_RECURSION_DEPTH) {
      this.setAgentWorking(false);
      this.uiKarton.setState((draft) => {
        const chat = draft.agentChat?.activeChat;
        if (chat) {
          chat.error = {
            type: AgentErrorType.AGENT_ERROR,
            error: {
              message: `Maximum recursion depth exceeded: Reached depth ${this.recursionDepth} of ${MAX_RECURSION_DEPTH}`,
              code: 'RECURSION_LIMIT',
              errorType: 'UnknownError',
            },
          };
        }
      });
      return;
    }

    this.recursionDepth++;

    try {
      const lastMessage = history?.at(-1);
      const isUserMessage = lastMessage?.role === 'user';
      const isFirstUserMessage =
        history?.filter((m) => m.role === 'user').length === 1;
      const lastMessageMetadata = isUserMessage
        ? { isUserMessage: true as const, message: lastMessage }
        : { isUserMessage: false as const, message: lastMessage };

      // Reset turn tracking when starting a new user message turn
      // (not on recursive calls after tool execution)
      if (isUserMessage) {
        this.currentTurnHasToolResult = false;
        this.currentTurnTextLength = 0;
        this.currentTurnIsThinking = false;
      }

      // Capture the current abort signal before any async operations
      // This ensures we can detect if abort was called during async operations
      const signalBeforeAsyncOps = this.abortController.signal;

      if (isFirstUserMessage && lastMessageMetadata.isUserMessage) {
        const title = await generateChatTitle(
          history,
          this.telemetryService.withTracing(
            getArbitraryModel('gemini-3-flash-preview', this.apiKey),
            {
              posthogTraceId: `chat-title-${chatId}`,
              posthogProperties: {
                $ai_span_name: 'chat-title',
              },
            },
          ),
        );

        // Update title in state
        this.uiKarton.setState((draft) => {
          const chat = draft.agentChat?.activeChat;
          if (chat) chat.title = title;
          // Also update in chatList
          const chatListEntry = draft.agentChat?.chatList.find(
            (c) => c.id === chatId,
          );
          if (chatListEntry) chatListEntry.title = title;
        });

        // Persist to DB
        try {
          await updateChatTitle(this.db, chatId, title);
        } catch (error) {
          this.logger.error('[AgentService] Failed to persist chat title', {
            error,
            chatId,
          });
        }
      }

      // Check if abort was called during the async operations above
      // If the original signal was aborted, we should not proceed with streaming
      if (signalBeforeAsyncOps.aborted) {
        this.cleanupPendingOperations('Aborted during async operations');
        return;
      }

      if (lastMessageMetadata.isUserMessage) {
        this.telemetryService.capture('agent-prompt-triggered');
      }

      const modelId = this.uiKarton.state.agentChat?.selectedModel?.modelId;

      const modelOptions = !modelId
        ? getModelOptions('claude-haiku-4-5', this.apiKey)
        : getModelOptions(modelId, this.apiKey);

      const model = this.telemetryService.withTracing(modelOptions.model, {
        posthogTraceId: chatId,
        posthogProperties: {
          $ai_span_name: 'agent-chat',
          developerTag: process.env.DEVELOPER_TAG || undefined,
          modelId,
        },
      });

      // Get the tools based on the agent mode
      const tools = toolsContext
        ? toolsWithoutExecute(toolsContext.tools)
        : null;

      // Collect LSP diagnostics for modified files in this chat
      const lspDiagnosticsByFile =
        await this.collectDiagnosticsForModifiedFiles(chatId);

      // Prepare messages before starting the stream
      // This is an async operation, so we do it before and check abort status after
      const messages = await this.promptBuilder.convertUIToModelMessages(
        history ?? [],
        lspDiagnosticsByFile,
      );

      // Check again if abort was called during message preparation
      if (signalBeforeAsyncOps.aborted) {
        this.cleanupPendingOperations('Aborted during message preparation');
        return;
      }

      const stream = streamText({
        model,
        // Use the captured signal instead of this.abortController.signal
        // This ensures abort is respected even if called during async operations above
        abortSignal: signalBeforeAsyncOps,
        maxOutputTokens: 10000,
        maxRetries: 0,
        providerOptions:
          'providerOptions' in modelOptions ? modelOptions.providerOptions : {},
        headers: 'headers' in modelOptions ? modelOptions.headers : {},
        messages,
        onError: async (error) => {
          await this.handleStreamingError(error, chatId);
        },
        tools: tools ?? {},
        onAbort: () => {
          this.authRetryCount = 0;
          this.cleanupPendingOperations('Agent call aborted');
        },
        experimental_transform: smoothStream({
          delayInMs: 10,
          chunking: 'word',
        }),
        experimental_repairToolCall: async (r) => {
          // Haiku often returns the tool input as string instead of object - we try to parse it as object
          // If the parsing fails, we simply return an invalid tool call
          this.logger.debug('[AgentService] Repairing tool call', r.error);
          this.telemetryService.captureException(r.error);
          if (NoSuchToolError.isInstance(r.error)) return r.toolCall;

          const tool = toolsContext
            ? tools?.[r.toolCall.toolName as keyof typeof tools]
            : null;
          if (!tool) return null;

          try {
            const input = JSON.parse(r.toolCall.input);
            if (typeof input === 'string') {
              const objectInput = JSON.parse(input); // Try to parse the input as object
              if (typeof objectInput === 'object' && objectInput !== null)
                return { ...r.toolCall, input: JSON.stringify(objectInput) };
            } else return null; // If not a string, it already failed the initial parsing check, so we return null
          } catch {
            return null;
          }
          return null;
        },
        onFinish: async (r) => {
          this.authRetryCount = 0;
          const messages =
            this.uiKarton.state.agentChat?.activeChat?.messages ?? [];

          // Get current tools context for processing tool calls
          const currentToolsContext = this.getToolsContext();
          if (!currentToolsContext) {
            this.logger.debug(
              '[AgentService] No tools context available for processing tool calls',
            );
            return;
          }

          const toolResults = await processToolCalls(
            r.toolCalls as any,
            currentToolsContext.tools as any,
            messages,
            (result) => {
              if (!this.isWorking) return;
              if ('result' in result && hasDiffMetadata(result.result)) {
              }
              // Strip 'nonSerializableMetadata' from result, attach the rest to the tool output
              const cleanResult =
                'result' in result
                  ? (() => {
                      const { nonSerializableMetadata: _, ...restResult } =
                        result.result;
                      return {
                        ...result,
                        result: restResult,
                      };
                    })()
                  : result;

              attachToolOutputToMessage(
                this.uiKarton as KartonStateProvider<KartonContract['state']>,
                [cleanResult],
                this.lastMessageId!,
              );
              // Mark that a tool result has been received in this turn
              this.currentTurnHasToolResult = true;
              this.telemetryService.capture('agent-tool-call-completed', {
                chat_id: chatId,
                message_id: this.lastMessageId!,
                tool_name:
                  r.toolCalls.find((tc) => tc.toolCallId === result.toolCallId)
                    ?.toolName ?? '',
                success: 'result' in result,
                duration: result.duration,
                tool_call_id: result.toolCallId,
                error_message:
                  'error' in result ? result.error.message : undefined,
              });
            },
            (error) => {
              this.logger.debug(
                `[AgentService] Agent failed:  ${error.message} ${error.stack}`,
              );
              this.telemetryService.captureException(error as Error);
            },
          );

          // Sync modified files with LSP server for diagnostics
          // Collect promises so we can wait for LSP updates before next agent call
          const lspUpdatePromises: Promise<void>[] = [];

          for (const result of toolResults) {
            if ('result' in result && hasDiffMetadata(result.result)) {
              const diff = result.result.hiddenFromLLM.diff;
              if (diff.after !== null) {
                // Track modified files for diagnostics collection (per chat)
                this.modifiedFilesPerChat.get(chatId)?.add(diff.path);

                // Update LSP if available - first touch (spawns clients + opens doc), then update content
                if (this.lspService) {
                  const content = diff.after; // Capture for closure
                  const updatePromise = this.lspService
                    .touchFile(diff.path)
                    .then(() => this.lspService?.updateFile(diff.path, content))
                    .catch((err: unknown) => {
                      this.logger.debug(
                        '[AgentService] Failed to update LSP document',
                        { error: err, path: diff.path },
                      );
                    });
                  lspUpdatePromises.push(updatePromise);
                }
              }
            }
          }

          // If file edits occurred, wait for LSP updates and diagnostics to settle
          // This ensures diagnostics are available in the system prompt for the next agent call
          if (lspUpdatePromises.length > 0) {
            // Wait for LSP updates with a timeout to prevent hanging if LSP is unresponsive
            const LSP_UPDATE_TIMEOUT_MS = 2000;
            await Promise.race([
              Promise.all(lspUpdatePromises),
              new Promise<void>((resolve) =>
                setTimeout(resolve, LSP_UPDATE_TIMEOUT_MS),
              ),
            ]);
            // Wait briefly for diagnostics to arrive after file edits
            await new Promise((resolve) => setTimeout(resolve, 150));
          }

          // Update the used context window size of the chat
          this.uiKarton.setState((draft) => {
            const chat = draft.agentChat?.activeChat;
            if (chat && r.totalUsage.inputTokens) {
              chat.usage.usedContextWindowSize = r.totalUsage.inputTokens;
            }
          });

          // Check if we need to compact the chat history (separate from state update)
          this.triggerCompactionIfNeeded(chatId);

          // Persist assistant message to SQLite
          const chatMessages =
            this.uiKarton.state.agentChat?.activeChat?.messages ?? [];
          if (this.lastMessageId) {
            const assistantMessage = chatMessages.find(
              (m) => m.id === this.lastMessageId,
            );
            if (assistantMessage) {
              const messageIndex = chatMessages.findIndex(
                (m) => m.id === this.lastMessageId,
              );
              try {
                await insertMessage(this.db, {
                  id: assistantMessage.id,
                  chatId,
                  messageIndex,
                  content: assistantMessage,
                });
                await this.updateChatLastModified(chatId);
              } catch (error) {
                this.logger.error(
                  '[AgentService] Failed to persist assistant message',
                  {
                    error,
                    chatId,
                    messageId: assistantMessage.id,
                  },
                );
              }
            }
          }

          const requiresUserInteraction = toolResults.some(
            (r) => 'userInteractionrequired' in r && r.userInteractionrequired,
          );

          if (
            !requiresUserInteraction &&
            toolResults.length > 0 &&
            this.isWorking
          ) {
            const updatedMessages =
              this.uiKarton.state.agentChat?.activeChat?.messages;

            return this.callAgent({
              chatId,
              history: updatedMessages,
            });
          }

          this.cleanupPendingOperations(
            'Agent task completed successfully',
            false,
            undefined,
            true, // Process next queued message on natural completion
          );
        },
      });

      const uiMessages = stream.toUIMessageStream({
        generateMessageId: generateId,
      }) as AsyncIterableStream<InferUIMessageChunk<ChatMessage>>;

      await this.parseUiStream(uiMessages, (messageId) => {
        this.lastMessageId = messageId;
      });
    } catch (error) {
      this.logger.debug(
        `[AgentService] Agent failed: ${error instanceof Error ? error.message : JSON.stringify(error)} ${error instanceof Error ? error.stack : ''}`,
      );
      this.telemetryService.captureException(error as Error);
      const structuredError = extractStructuredError(error);
      this.setAgentWorking(false);
      this.uiKarton.setState((draft) => {
        const chat = draft.agentChat?.activeChat;
        if (chat) {
          chat.error = {
            type: AgentErrorType.AGENT_ERROR,
            error: structuredError,
          };
        }
      });
      return;
    } finally {
      this.recursionDepth = Math.max(0, this.recursionDepth - 1);
    }
  }

  private async parseUiStream(
    uiStream: ReadableStream<InferUIMessageChunk<ChatMessage>>,
    onNewMessage?: (messageId: string) => void,
  ) {
    const activeChatId = this.uiKarton.state.agentChat?.activeChat?.id;
    if (!activeChatId) return;

    // Initialize or get thinking durations state for this chat (persists across agent recursions)
    if (!this.thinkingDurationsPerChat.has(activeChatId)) {
      this.thinkingDurationsPerChat.set(activeChatId, {
        durations: [],
        currentStartTime: null,
      });
    }
    const thinkingState = this.thinkingDurationsPerChat.get(activeChatId)!;

    for await (const uiMessage of readUIMessageStream<ChatMessage>({
      stream: uiStream,
    })) {
      // Count reasoning parts in the accumulated message (from stream parts)
      const reasoningParts = uiMessage.parts.filter(
        (p) => p.type === 'reasoning',
      );
      const lastReasoningPart = reasoningParts[reasoningParts.length - 1];

      // The current reasoning part index is based on durations already recorded
      const nextExpectedIndex = thinkingState.durations.length;

      if (lastReasoningPart) {
        // Check if this is a NEW reasoning part we haven't recorded a duration for yet
        if (
          lastReasoningPart.state === 'streaming' &&
          thinkingState.currentStartTime === null &&
          thinkingState.durations[nextExpectedIndex] === undefined
        ) {
          // A new reasoning part has started
          thinkingState.currentStartTime = Date.now();
        } else if (
          lastReasoningPart.state === 'done' &&
          thinkingState.currentStartTime !== null &&
          thinkingState.durations[nextExpectedIndex] === undefined
        ) {
          // The current reasoning part has finished
          thinkingState.durations[nextExpectedIndex] =
            Date.now() - thinkingState.currentStartTime;
          thinkingState.currentStartTime = null;
        }
      }

      // Track current turn state for early abort detection
      // Check if agent is currently in thinking mode (has streaming reasoning part)
      this.currentTurnIsThinking = reasoningParts.some(
        (p) => p.type === 'reasoning' && p.state === 'streaming',
      );

      // Calculate total text content length (excluding reasoning parts)
      const textParts = uiMessage.parts.filter((p) => p.type === 'text');
      this.currentTurnTextLength = textParts.reduce(
        (total, part) => total + (part.type === 'text' ? part.text.length : 0),
        0,
      );

      const chat = this.uiKarton.state.agentChat?.activeChat;
      const existingMessage = chat?.messages.find((m) => m.id === uiMessage.id);
      const messageExists = !!existingMessage;

      // Use the accumulated durations from class-level state
      const thinkingDurations = [...thinkingState.durations];

      const uiMessageWithMetadata: ChatMessage = {
        ...uiMessage,
        metadata: {
          ...(uiMessage.metadata ?? {}),
          ...(thinkingDurations.length > 0 ? { thinkingDurations } : {}),
          partsMetadata: [],
          createdAt: new Date(),
        },
      };

      if (messageExists) {
        this.uiKarton.setState((draft) => {
          const chat = draft.agentChat?.activeChat;
          if (chat) {
            chat.messages = chat.messages.map((m) =>
              m.id === uiMessage.id
                ? (uiMessageWithMetadata as ChatMessage)
                : (m as any),
            );
          }
        });
      } else {
        onNewMessage?.(uiMessage.id);
        this.uiKarton.setState((draft) => {
          const chat = draft.agentChat?.activeChat;
          if (chat) {
            chat.messages.push(uiMessageWithMetadata as any);
          }
        });
      }
    }
  }

  /** Triggers compaction if context window usage exceeds 80%. */
  private triggerCompactionIfNeeded(_chatId: string): void {
    if (this.isCompacting) return;

    const chat = this.uiKarton.state.agentChat?.activeChat;
    if (!chat) return;

    const usedSize = chat.usage.usedContextWindowSize || 0;
    const maxSize = chat.usage.maxContextWindowSize;

    if (!maxSize || usedSize / maxSize <= 0.8) return;

    void this.compactChatHistory();
  }

  /**
   * Summarizes the middle portion of chat history and attaches it to the last user message.
   * Keeps first N pairs and last pair as raw messages; only the middle is summarized.
   * Supports indefinite compaction (can re-compact previously compacted content).
   */
  private async compactChatHistory() {
    if (this.isCompacting) {
      this.logger.debug(
        '[AgentService] Compaction already in progress, skipping',
      );
      return;
    }

    if (!this.apiKey) {
      this.logger.debug(
        '[AgentService] Cannot compact chat history: no API key available',
      );
      return;
    }

    const chatId = this.uiKarton.state.agentChat?.activeChat?.id;
    if (!chatId) return;

    // Set compacting flag before any async operations
    this.isCompacting = true;

    const chat = this.uiKarton.state.agentChat?.activeChat;
    const history = chat?.messages ?? [];

    // Find the last user message (where we'll attach the summary)
    let lastUserMessageIndex = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i]!.role === 'user') {
        lastUserMessageIndex = i;
        break;
      }
    }

    // Find where first N pairs end (these are kept raw, not summarized)
    const endOfFirstNPairs = findEndOfFirstNPairs(
      history,
      ORIGINAL_USER_MESSAGES_KEPT_WHEN_SUMMARIZING,
    );

    // Nothing to compact if no middle portion exists
    if (endOfFirstNPairs >= lastUserMessageIndex) {
      this.logger.debug(
        '[AgentService] Cannot compact: no messages between first N pairs and last user message',
      );
      this.isCompacting = false;
      return;
    }

    // Extract middle portion (between first N pairs and last user message)
    const messagesToCompact = history.slice(
      endOfFirstNPairs,
      lastUserMessageIndex,
    );

    // Convert to model messages and remove system prompt
    const allModelMessages =
      await this.promptBuilder.convertUIToModelMessages(messagesToCompact);
    const messagesForSummary = allModelMessages.slice(1);

    if (messagesForSummary.length === 0) {
      this.logger.debug(
        '[AgentService] Cannot compact: no messages to summarize in the middle portion',
      );
      this.isCompacting = false;
      return;
    }

    this.logger.debug(
      `[AgentService] Compacting ${messagesForSummary.length} model messages from middle portion`,
    );

    try {
      const summary = await summarizeChatHistory(
        messagesForSummary,
        this.telemetryService.withTracing(
          getArbitraryModel('gemini-2.5-flash', this.apiKey),
          {
            // TODO: update to use 3-flash when the backend supports it
            posthogTraceId: `compact-chat-${chatId}`,
            posthogProperties: {
              $ai_span_name: 'compact-chat-history',
            },
          },
        ),
      );

      // Attach summary to last user message's metadata
      this.uiKarton.setState((draft) => {
        const draftChat = draft.agentChat?.activeChat;
        if (draftChat) {
          const userMessage = draftChat.messages[lastUserMessageIndex];
          if (userMessage && userMessage.role === 'user') {
            const existingMetadata = userMessage.metadata ?? {
              createdAt: new Date(),
            };
            userMessage.metadata = {
              ...existingMetadata,
              autoCompactInformation: {
                isAutoCompacted: true,
                compactedAt: new Date(),
                chatSummary: summary,
              },
              partsMetadata: [],
            };
          }
        }
      });

      this.logger.debug(
        `[AgentService] Chat history compacted successfully. Summary length: ${summary.length} chars`,
      );

      this.telemetryService.capture('chat-history-compacted', {
        chat_id: chatId,
        messages_compacted: messagesForSummary.length,
        summary_length: summary.length,
      });
    } catch (error) {
      this.logger.debug('[AgentService] Failed to compact chat history', {
        cause: error,
      });
      this.telemetryService.captureException(error as Error);
    } finally {
      // Always reset the compacting flag
      this.isCompacting = false;
    }
  }

  private async undoEditsUntilUserMessage(
    userMessageId: string,
    chatId: string,
    type: 'restore-checkpoint' | 'undo-changes' = 'restore-checkpoint',
  ): Promise<void> {
    const chat = this.uiKarton.state.agentChat?.activeChat;
    const history = chat?.messages ?? [];
    const userMessageIndex = history.findIndex(
      (m) => m.role === 'user' && 'id' in m && m.id === userMessageId,
    );

    const messagesAfterUserMessage =
      userMessageIndex !== -1 ? history.slice(userMessageIndex + 1) : [];

    const assistantMessagesAfterUserMessage = messagesAfterUserMessage.filter(
      (m) => m.role === 'assistant',
    );

    const toolCallIdsAfterUserMessage: string[] = [];
    for (const message of assistantMessagesAfterUserMessage) {
      for (const content of message.parts) {
        if (isToolCallType(content.type)) {
          toolCallIdsAfterUserMessage.push((content as ToolUIPart).toolCallId);
        }
      }
    }

    const _idsAfter = new Set(toolCallIdsAfterUserMessage);
    const toolCallsUndone: Map<string, number> = new Map();

    this.uiKarton.setState((draft) => {
      if (userMessageIndex !== -1) {
        const chat = draft.agentChat?.activeChat;
        if (chat) chat.messages = history.slice(0, userMessageIndex) as any;
      }
    });

    // Delete truncated messages from SQLite
    if (userMessageIndex !== -1) {
      try {
        await deleteMessagesFromIndex(this.db, chatId, userMessageIndex);
      } catch (error) {
        this.logger.error(
          '[AgentService] Failed to delete truncated messages from DB',
          {
            error,
            chatId,
            fromIndex: userMessageIndex,
          },
        );
      }
    }

    this.telemetryService.capture('agent-undo-tool-calls', {
      chat_id: chatId,
      message_id: userMessageId,
      messages_undone_amount: {
        assistant: assistantMessagesAfterUserMessage.length,
        total: messagesAfterUserMessage.length,
      },
      tool_calls_undone_amount: Object.fromEntries(toolCallsUndone),
      type,
    });
  }

  /**
   * Collect LSP diagnostics for all files modified in the specified chat.
   * Returns a Map of file paths to their aggregated diagnostics.
   */
  private async collectDiagnosticsForModifiedFiles(
    chatId: ChatId,
  ): Promise<DiagnosticsByFile> {
    const result: DiagnosticsByFile = new Map();

    const modifiedFiles = this.modifiedFilesPerChat.get(chatId);
    if (!this.lspService || !modifiedFiles || modifiedFiles.size === 0) {
      return result;
    }

    for (const filePath of modifiedFiles) {
      try {
        const diagnostics =
          await this.lspService.getDiagnosticsForFile(filePath);
        if (diagnostics.length > 0) result.set(filePath, diagnostics);
      } catch (err) {
        this.logger.debug('[AgentService] Failed to get diagnostics for file', {
          error: err,
          path: filePath,
        });
      }
    }

    return result;
  }

  public teardown() {
    this.removeServerProcedureHandlers();
    this.authService.unregisterAuthStateChangeCallback(this.onAuthStateChange);
    this.cleanupPendingOperations('Agent teardown');

    // Teardown LspService
    void this.lspService?.teardown();
    this.lspService = null;

    // Clear modified files tracking
    this.modifiedFilesPerChat.clear();

    this.logger.debug('[AgentService] Shutdown complete');
  }

  public static async create(
    logger: Logger,
    telemetryService: TelemetryService,
    uiKarton: KartonService,
    globalConfigService: GlobalConfigService,
    authService: AuthService,
    windowLayoutService: WindowLayoutService,
    globalDataPathService: GlobalDataPathService,
  ) {
    const instance = new AgentService(
      logger,
      telemetryService,
      uiKarton,
      globalConfigService,
      authService,
      windowLayoutService,
      globalDataPathService,
    );
    await instance.initialize();
    logger.debug('[AgentService] Created service');
    return instance;
  }

  /**
   * Performs a warm-up request to the LLM to ensure the cache is seeded and latency is minimized.
   * @returns The response from the warm-up request.
   */
  private async warmUpLLMProxyCache() {
    if (!this.apiKey) {
      this.logger.debug(
        '[AgentService] No API key available. Warm up request failed, please sign in before using the agent.',
      );
      return;
    }
    return generateText({
      model: this.telemetryService.withTracing(
        getArbitraryModel('gemini-2.5-flash', this.apiKey),
        {
          posthogTraceId: 'warm-up-request',
          posthogProperties: {
            $ai_span_name: 'warm-up-request',
          },
        },
      ),
      temperature: 0.1,
      maxOutputTokens: 100,
      providerOptions: {
        anthropic: {
          thinking: {
            type: 'disabled',
          },
        } satisfies AnthropicProviderOptions,
      },
      messages: [
        { role: 'system', content: 'Respond with "Hey there!"' },
        { role: 'user', content: 'Hey bud!' },
      ],
    }).catch((error) => {
      this.logger.debug('[AgentService] Failed to warm up LLM proxy cache', {
        cause: error,
      });
    });
  }

  private async handleStreamingError(
    error: { error: unknown },
    chatId: string,
  ) {
    if (isAbortError(error.error)) {
      this.authRetryCount = 0;
      this.cleanupPendingOperations('Agent call aborted');
    } else if (isPlanLimitsExceededError(error.error)) {
      const planLimitsExceededError = isPlanLimitsExceededError(
        error.error,
      ) as PlanLimitsExceededError;
      this.authRetryCount = 0;

      this.telemetryService.capture('agent-plan-limits-exceeded', {
        hasSubscription: this.uiKarton.state.userAccount?.subscription?.active,
        isPaidPlan: planLimitsExceededError.data.isPaidPlan || false,
        cooldownMinutes: planLimitsExceededError.data.cooldownMinutes,
      });

      this.uiKarton.setState((draft) => {
        const chat = draft.agentChat?.activeChat;
        if (chat) {
          chat.error = {
            type: AgentErrorType.PLAN_LIMITS_EXCEEDED,
            error: {
              name: 'Plan limit exceeded',
              message: `Plan limit exceeded, please wait ${planLimitsExceededError.data.cooldownMinutes} minutes before your next request.`,
              isPaidPlan: planLimitsExceededError.data.isPaidPlan || false,
              cooldownMinutes: planLimitsExceededError.data.cooldownMinutes,
            },
          };
        }
      });

      this.pauseMessageQueue(chatId);
      this.cleanupPendingOperations('Plan limits exceeded');
      return;
    } else if (
      isAuthenticationError(error.error) &&
      this.authRetryCount < this.maxAuthRetries
    ) {
      this.logger.debug('[Agent Service]: Error', error.error);
      this.authRetryCount++;

      // Auth service will handle token refresh internally
      // We just need to reinitialize our client
      await this.initializeClient();

      const messages = this.uiKarton.state.agentChat?.activeChat?.messages;
      await this.callAgent({
        chatId,
        history: messages,
      });
      return;
    } else if (
      isAuthenticationError(error.error) &&
      this.authRetryCount >= this.maxAuthRetries
    ) {
      this.authRetryCount = 0;
      this.setAgentWorking(false);
      this.uiKarton.setState((draft) => {
        const chat = draft.agentChat?.activeChat;
        if (chat) {
          chat.error = {
            type: AgentErrorType.AGENT_ERROR,
            error: {
              message: 'Authentication failed, please restart the app.',
              code: '401',
              errorType: 'AI_APICallError',
            },
          };
        }
      });
      this.pauseMessageQueue(chatId);
      return;
    } else if (isContextLimitError(error.error)) {
      this.uiKarton.setState((draft) => {
        const chat = draft.agentChat?.activeChat;
        if (chat)
          chat.error = {
            type: AgentErrorType.CONTEXT_LIMIT_EXCEEDED,
            error: {
              name: 'Context limit exceeded',
              message:
                'This chat exceeds the context limit. Please start a new chat.',
            },
          };
      });
      this.pauseMessageQueue(chatId);
      this.cleanupPendingOperations('Context limit exceeded');
      return;
    } else {
      this.logger.debug(`[Agent Service] Agent failed: ${error.error}`);
      this.telemetryService.captureException(error.error as Error);
      const structuredError = extractStructuredError(error.error);
      this.setAgentWorking(false);
      this.uiKarton.setState((draft) => {
        const chat = draft.agentChat?.activeChat;
        if (chat) {
          chat.error = {
            type: AgentErrorType.AGENT_ERROR,
            error: structuredError,
          };
        }
      });
      this.pauseMessageQueue(chatId);
    }
  }

  // Public methods for accepting/rejecting pending edits (called from main.ts via pages-api)

  /**
   * Accept all pending edits for the active chat
   */
  public acceptAllPendingEdits(): void {}

  /**
   * Reject all pending edits for the active chat
   */
  public rejectAllPendingEdits(): void {}

  /**
   * Accept a single pending edit by file path
   */
  public acceptPendingEdit(_filePath: string): void {}

  /**
   * Reject a single pending edit by file path
   */
  public rejectPendingEdit(_filePath: string): void {}

  /**
   * Resets the diff history. Call acceptAllPendingEdits() first to clear UI state.
   * Used when workspace changes to prevent operations on invalid paths.
   */
  public resetDiffHistory(): void {}
}
