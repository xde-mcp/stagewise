import type { BaseAgent } from '@/agents/shared/base-agent';
import {
  type AgentHistoryEntry,
  AgentTypes,
} from '@shared/karton-contracts/ui/agent';
import { DisposableService } from '../disposable';
import type { ChatMessage } from '@shared/karton-contracts/ui';
import { AgentsMap } from '@/agents/agents-map';
import { randomUUID } from 'node:crypto';
import type { KartonService } from '../karton';
import type { TelemetryService } from '../telemetry';
import type { Logger } from '../logger';
import type { ToolboxService } from '../toolbox';
import type { ModelProviderService } from '@/agents/model-provider';
import type { ModelId } from '@shared/available-models';
import type { z } from 'zod';
import { AgentPersistenceDB } from './persistence/db';
import type { GlobalDataPathService } from '../global-data-path';
import type { AgentState } from '@shared/karton-contracts/ui/agent';

export class AgentManagerService extends DisposableService {
  private activeAgents = new Map<string, BaseAgent<any, any>>();

  private readonly karton: KartonService;
  private readonly globalDataPathService: GlobalDataPathService;
  private readonly telemetryService: TelemetryService;
  private readonly toolbox: ToolboxService;
  private readonly logger: Logger;
  private readonly modelProviderService: ModelProviderService;

  private agentPersistenceDB: AgentPersistenceDB | null = null;
  private readonly dbReadyPromise: Promise<AgentPersistenceDB | null>;

  public constructor(
    karton: KartonService,
    globalDataPathService: GlobalDataPathService,
    telemetryService: TelemetryService,
    toolbox: ToolboxService,
    logger: Logger,
    modelProviderService: ModelProviderService,
  ) {
    super();
    this.karton = karton;
    this.globalDataPathService = globalDataPathService;
    this.telemetryService = telemetryService;
    this.toolbox = toolbox;
    this.logger = logger;
    this.modelProviderService = modelProviderService;

    this.registerKartonHandlers();

    // Initialize the DB and store the promise so we can await it in handlers
    this.dbReadyPromise = AgentPersistenceDB.create(
      globalDataPathService,
      logger,
    ).then((db) => {
      this.agentPersistenceDB = db;
      return db;
    });

    // Create an empty default agent only after the DB is ready
    // This ensures that when there's an active agent, the DB is guaranteed to be initialized
    this.dbReadyPromise.then(() => {
      this.createAgent(AgentTypes.CHAT);
    });
  }

  /**
   * Ensures the persistence DB is ready before performing operations.
   * Returns the DB instance or null if initialization failed.
   */
  private async ensureDBReady(): Promise<AgentPersistenceDB | null> {
    await this.dbReadyPromise;
    return this.agentPersistenceDB;
  }

  /**
   * Register all Karton procedure handlers.
   * Extracted to separate method to avoid "Expression produces a union type
   * that is too complex to represent" error in the constructor.
   */
  private registerKartonHandlers(): void {
    this.karton.registerServerProcedureHandler(
      'agents.create',
      async (_callingClientId: string) => {
        return (await this.createAgent(AgentTypes.CHAT)).instanceId;
      },
    );
    this.karton.registerServerProcedureHandler(
      'agents.resume',
      async (_callingClientId: string, instanceId: string) => {
        await this.resumeAgent(instanceId);
        return;
      },
    );

    this.karton.registerServerProcedureHandler(
      'agents.sendUserMessage',
      async (
        _callingClientId: string,
        instanceId: string,
        message: ChatMessage & { role: 'user' },
      ) => {
        await this.sendUserMessage(instanceId, message);
      },
    );
    this.karton.registerServerProcedureHandler(
      'agents.sendToolApprovalResponse',
      async (
        _callingClientId: string,
        instanceId: string,
        approvalId: string,
        approved: boolean,
        reason?: string,
      ) => {
        await this.sendToolApprovalResponse(
          instanceId,
          approvalId,
          approved,
          reason,
        );
      },
    );
    this.karton.registerServerProcedureHandler(
      'agents.stop',
      async (_callingClientId: string, instanceId: string) => {
        await this.stopAgent(instanceId);
      },
    );
    this.karton.registerServerProcedureHandler(
      'agents.flushQueue',
      async (_callingClientId: string, instanceId: string) => {
        await this.flushQueue(instanceId);
      },
    );
    this.karton.registerServerProcedureHandler(
      'agents.clearQueue',
      async (_callingClientId: string, instanceId: string) => {
        await this.clearQueue(instanceId);
      },
    );
    this.karton.registerServerProcedureHandler(
      'agents.deleteQueuedMessage',
      async (
        _callingClientId: string,
        instanceId: string,
        messageId: string,
      ) => {
        await this.deleteQueuedMessage(instanceId, messageId);
      },
    );
    this.karton.registerServerProcedureHandler(
      'agents.revertToUserMessage',
      async (
        _callingClientId: string,
        instanceId: string,
        userMessageId: string,
        undoToolCalls: boolean,
      ) => {
        await this.revertToUserMessage(
          instanceId,
          userMessageId,
          undoToolCalls,
        );
      },
    );
    this.karton.registerServerProcedureHandler(
      'agents.replaceUserMessage',
      async (
        _callingClientId: string,
        instanceId: string,
        userMessageId: string,
        newMessage: ChatMessage & { role: 'user' },
      ) => {
        return await this.replaceUserMessage(
          instanceId,
          userMessageId,
          newMessage,
        );
      },
    );
    this.karton.registerServerProcedureHandler(
      'agents.delete',
      async (_callingClientId: string, instanceId: string) => {
        await this.deleteAgent(instanceId);
      },
    );
    this.karton.registerServerProcedureHandler(
      'agents.setActiveModelId',
      async (
        _callingClientId: string,
        instanceId: string,
        modelId: ModelId,
      ) => {
        await this.updateActiveModelId(instanceId, modelId);
      },
    );
    this.karton.registerServerProcedureHandler(
      'agents.getAgentsHistoryList',
      async (
        _callingClientId: string,
        offset: number,
        limit: number,
        searchString?: string,
      ) => {
        return await this.getAgentsHistoryList(offset, limit, searchString);
      },
    );
    this.karton.registerServerProcedureHandler(
      'agents.updateInputState',
      async (
        _callingClientId: string,
        instanceId: string,
        inputState: string,
      ) => {
        await this.updateInputState(instanceId, inputState);
      },
    );
  }

  protected onTeardown(): Promise<void> | void {}

  // Create a new agent. Should be called when the user creates a new agent.
  public async createAgent<TAgentType extends AgentTypes>(
    type: TAgentType,
    parent?: {
      parentInstanceId: string;
      parentHistory: ChatMessage[];
      onFinish: (
        finishOutput: z.infer<
          (typeof AgentsMap)[TAgentType]['config']['finishToolOutputSchema']
        >,
      ) => void | Promise<void>;
      onError: (error: Error) => void | Promise<void>;
    },
    initialState?: AgentState,
  ): Promise<InstanceType<(typeof AgentsMap)[TAgentType]>> {
    const agentInstanceId = randomUUID();

    // Build state object outside setState to avoid "Type instantiation is excessively deep" error
    // caused by complex Draft<ChatMessage[]> inference from the 'ai' package's UIMessage type
    const agentState: AgentState = {
      title: initialState?.title ?? '',
      isWorking: false,
      history: initialState?.history ?? [],
      compactedHistory: initialState?.compactedHistory ?? undefined,
      lastCompactedMessageId: initialState?.lastCompactedMessageId ?? undefined,
      queuedMessages: initialState?.queuedMessages ?? [],
      activeModelId: initialState?.activeModelId ?? 'claude-haiku-4-5',
      inputState: initialState?.inputState ?? '',
      usedTokens: initialState?.usedTokens ?? 0,
    };

    // Use type assertion to avoid "Type instantiation is excessively deep" error
    // caused by Draft<> inference on deeply nested ChatMessage types from 'ai' package
    this.karton.setState((draft) => {
      (draft.agents.instances as Record<string, unknown>)[agentInstanceId] = {
        type: type,
        canSelectModel: AgentsMap[type].config.allowModelSelection,
        requiredModelCapabilities: AgentsMap[type].config.requiredCapabilities,
        allowUserInput: AgentsMap[type].config.allowUserInput,
        parentAgentInstanceId: parent?.parentInstanceId ?? null,
        state: agentState,
      };
    });

    this.logger.info(
      `[AgentManager] Creating agent. ID: ${agentInstanceId}, Type: ${type}`,
    );

    const agent = new AgentsMap[type](
      agentInstanceId,
      {
        get: () => this.karton.state.agents.instances[agentInstanceId].state,
        set: (recipe) => {
          this.logger.debug(
            `[AgentManager] Updating agent state. ID: ${agentInstanceId}, Type: ${type}`,
          );
          this.karton.setState((draft) => {
            // @ts-ignore - We have to call the state update recipe with the draft this way to keep "immer" working.
            recipe(draft.agents.instances[agentInstanceId].state);
            draft.agents.instances[agentInstanceId].type = type;
          });
        },
        persist: () => this.persistAgentState(agentInstanceId),
      },
      this.toolbox,
      this.telemetryService,
      this.logger,
      this.modelProviderService,
      async <TChildAgentType extends AgentTypes>(
        childAgentType: TChildAgentType,
        history: ChatMessage[],
        onFinish: (
          finishOutput: z.infer<
            (typeof AgentsMap)[TChildAgentType]['config']['finishToolOutputSchema']
          >,
        ) => void | Promise<void>,
        onError: (error: Error) => void | Promise<void>,
      ) => {
        const childAgent = await this.createAgent(childAgentType, {
          parentInstanceId: agentInstanceId,
          parentHistory: history,
          onFinish: onFinish,
          onError: onError,
        });

        return childAgent;
      },
      // @ts-ignore - The onFinish handler returns outputs with the configured schema of the agent. dunno why ts doesn't get this right.
      parent?.onFinish,
      parent?.onError,
    );

    this.activeAgents.set(agentInstanceId, agent);

    return agent as unknown as InstanceType<(typeof AgentsMap)[TAgentType]>;
  }

  // Resume an agent form the last persisted state. Should probably be called when the user select the agent from a list of previous agents.
  public async resumeAgent(_instanceId: string) {
    // Early exit if the agent is already active.
    if (this.activeAgents.has(_instanceId)) {
      return this.activeAgents.get(_instanceId);
    }

    // Right now, we don't allow resuming sub-agents (because persisted agents stop all their tools calls anyway when they arew stopped and resumed - including any child agents).
    const agent =
      await this.agentPersistenceDB?.getStoredAgentInstanceById(_instanceId);
    if (!agent) {
      throw new Error(`Agent with instance id ${_instanceId} not found`);
    }

    if (agent.parentAgentInstanceId) {
      throw new Error(
        `Agent with instance id ${_instanceId} is a sub-agent and cannot be resumed`,
      );
    }

    return await this.createAgent(agent.type, undefined, {
      title: agent.title,
      history: agent.history,
      compactedHistory: agent.compactedHistory ?? undefined,
      lastCompactedMessageId: agent.lastCompactedMessageId ?? undefined,
      queuedMessages: agent.queuedMessages,
      activeModelId: agent.activeModelId,
      inputState: agent.inputState,
      usedTokens: agent.usedTokens,
      isWorking: false,
    });
  }

  private async persistAgentState(instanceId: string) {
    // Store agent state into DB.
    const agent = this.activeAgents.get(instanceId);

    const agentState = this.karton.state.agents.instances[instanceId].state;

    if (!agent || !agentState) {
      throw new Error(`Agent with instance id ${instanceId} not found`);
    }

    if (agentState.history.length === 0) {
      // We don't persist empty agents.
    }

    await this.agentPersistenceDB?.storeAgentInstance({
      id: instanceId,
      type: agent.agentType,
      title: agentState.title,
      history: agentState.history,
      activeModelId: agentState.activeModelId,
      createdAt: agentState.history[0].metadata?.createdAt ?? new Date(0), // Fallback should never be reached
      lastMessageAt:
        agentState.history[agentState.history.length - 1].metadata?.createdAt ??
        new Date(), // Fallback should never be reached
      lastCompactedMessageId: agentState.lastCompactedMessageId,
      compactedHistory: agentState.compactedHistory,
      queuedMessages: agentState.queuedMessages,
      inputState: agentState.inputState,
      usedTokens: agentState.usedTokens,
    });
  }

  /**
   * Deletes an agent and all it's child agents permanently.
   *
   * @param instanceId The agent instance that should be deleted
   *
   * @note If you just want to stop an agent and remove it from the list of loaded agents, use the `archiveAgent` method instead.
   */
  private async deleteAgent(instanceId: string) {
    this.logger.debug(`[AgentManager] Deleting agent. ID: ${instanceId}`);
    // First we archive the agent (stops it, deletes it from list of loaded agents while keeping the persisted state intact)
    await this.archiveAgent(instanceId);

    this.logger.debug(`[AgentManager] Agent archived. ID: ${instanceId}`);

    if (!this.agentPersistenceDB) {
      throw new Error('Agent persistence DB not found');
    }

    // Clear the agent from the persistence layer. This also clears all child agents from the persistence layer so we have double safety that all agents are deleted.
    await this.agentPersistenceDB?.deleteAgentInstance(instanceId);
  }

  /**
   * Stops an agent and deletes it's active instance while keeping the persisted state intact - must be resumed when it should be opened again.
   * @param instanceId The agent instance that should be archived (stopped and only persistence kept)
   */
  private async archiveAgent(instanceId: string) {
    this.logger.debug(`[AgentManager] Archiving agent. ID: ${instanceId}`);
    // Stop this agent and all child agents
    const agent = this.activeAgents.get(instanceId);

    if (!agent) {
      return;
    }

    await agent.stop();

    // Make sure to let the agent finish tool return with a failure so that a potential parent understands that the agent instance was deleted.
    await agent.reportErrorToParent(
      new Error("Agent was stopped and deleted before finishing it's task."),
    );

    // Delete all child agents as well. Do this recursively.
    const childAgentInstanceIds = Object.entries(
      this.karton.state.agents.instances,
    )
      .filter(([_, instance]) => instance.parentAgentInstanceId === instanceId)
      .map(([id]) => id);
    for (const childAgentInstanceId of childAgentInstanceIds) {
      await this.deleteAgent(childAgentInstanceId);
    }

    // Clear the active agents map.
    this.activeAgents.delete(instanceId);

    // Clear the karton state of the agent.
    this.karton.setState((draft) => {
      delete draft.agents.instances[instanceId];
    });
  }

  /**
   * ===============================
   * KARTON HANDLERS
   * ===============================
   */

  /**
   * Send a message to a specific agent
   */
  public async sendUserMessage(
    instanceId: string,
    message: ChatMessage & { role: 'user' },
  ) {
    const agent = this.activeAgents.get(instanceId);

    if (!agent) {
      throw new Error(`Agent with instance id ${instanceId} not found`);
    }

    await agent.sendUserMessage(message);
  }

  /**
   * Send a tool approval response to a specific agent
   */
  public async sendToolApprovalResponse(
    instanceId: string,
    approvalId: string,
    approved: boolean,
    reason?: string,
  ) {
    const agent = this.activeAgents.get(instanceId);

    if (!agent) {
      throw new Error(`Agent with instance id ${instanceId} not found`);
    }

    await agent.sendToolApprovalResponse({
      type: 'tool-approval-response',
      approvalId: approvalId,
      approved: approved,
      reason: reason,
    });
  }

  /**
   * Stop a specific agent
   */
  public async stopAgent(instanceId: string) {
    const agent = this.activeAgents.get(instanceId);

    if (!agent) {
      throw new Error(`Agent with instance id ${instanceId} not found`);
    }

    const childAgents = Object.entries(this.karton.state.agents.instances)
      .filter(([_, instance]) => instance.parentAgentInstanceId === instanceId)
      .map(([id]) => id);

    for (const childAgentInstanceId of childAgents) {
      await this.stopAgent(childAgentInstanceId);
    }

    await agent.stop();
  }

  /**
   * Flush the queue of a specific agent
   */
  public async flushQueue(instanceId: string) {
    const agent = this.activeAgents.get(instanceId);

    if (!agent) {
      throw new Error(`Agent with instance id ${instanceId} not found`);
    }

    await agent.flushQueue();
  }

  /**
   * Clear the queue of a specific agent
   */
  public async clearQueue(instanceId: string) {
    const agent = this.activeAgents.get(instanceId);

    if (!agent) {
      throw new Error(`Agent with instance id ${instanceId} not found`);
    }

    await agent.clearQueue();
  }

  /**
   * Delete queued message of an agent
   */
  public async deleteQueuedMessage(instanceId: string, messageId: string) {
    const agent = this.activeAgents.get(instanceId);

    if (!agent) {
      throw new Error(`Agent with instance id ${instanceId} not found`);
    }

    await agent.deleteQueuedMessage(messageId);
  }

  /**
   * Revert to a user message of an agent
   * @param instanceId
   * @param userMessageId
   * @param undoToolCalls
   */
  public async revertToUserMessage(
    instanceId: string,
    userMessageId: string,
    undoToolCalls: boolean,
  ) {
    const agent = this.activeAgents.get(instanceId);

    if (!agent) {
      throw new Error(`Agent with instance id ${instanceId} not found`);
    }

    await agent.revertToUserMessage(userMessageId, undoToolCalls);
  }

  public async replaceUserMessage(
    instanceId: string,
    userMessageId: string,
    newMessage: ChatMessage & { role: 'user' },
  ): Promise<string> {
    const agent = this.activeAgents.get(instanceId);

    if (!agent) {
      throw new Error(`Agent with instance id ${instanceId} not found`);
    }

    return await agent.replaceUserMessage(userMessageId, newMessage);
  }

  private async updateInputState(instanceId: string, inputString: string) {
    const agent = this.activeAgents.get(instanceId);

    if (!agent) {
      throw new Error(`Agent with instance id ${instanceId} not found`);
    }

    await agent.updateInputState(inputString);
  }

  private async updateActiveModelId(instanceId: string, modelId: ModelId) {
    const agent = this.activeAgents.get(instanceId);
    if (!agent) {
      throw new Error(`Agent with instance id ${instanceId} not found`);
    }
    await agent.updateActiveModelId(modelId);
  }

  /**
   * Responds with a list of agent history entries. Includes all existing agents (including currently active ones) and is sorted by agents (newest first).
   *
   * @param offset The offset to fetch the agents from
   * @param limit The number of agents to fetch
   * @param searchString The search string to filter the agents by (optional, case-insensitive)
   * @returns A list of agent history entries
   */
  private async getAgentsHistoryList(
    offset: number,
    limit: number,
    searchString?: string,
  ): Promise<AgentHistoryEntry[]> {
    // Wait for DB to be ready before querying
    const db = await this.ensureDBReady();

    // If the db initialization failed, return empty array
    if (!db) {
      return [];
    }

    return await db.getAgentHistoryEntries(
      limit,
      offset,
      [],
      searchString && searchString.trim().length > 0
        ? `%${searchString.trim()}%`
        : undefined,
    );
  }
}
