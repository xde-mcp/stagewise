import type { BaseAgent } from '@/agents/shared/base-agent';
import { AgentTypes } from '@shared/karton-contracts/ui/agent';
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

export class AgentManagerService extends DisposableService {
  private activeAgents = new Map<string, BaseAgent<any, any>>();

  private readonly karton: KartonService;
  private readonly telemetryService: TelemetryService;
  private readonly toolbox: ToolboxService;
  private readonly logger: Logger;
  private readonly modelProviderService: ModelProviderService;

  public constructor(
    karton: KartonService,
    telemetryService: TelemetryService,
    toolbox: ToolboxService,
    logger: Logger,
    modelProviderService: ModelProviderService,
  ) {
    super();
    this.karton = karton;
    this.telemetryService = telemetryService;
    this.toolbox = toolbox;
    this.logger = logger;
    this.modelProviderService = modelProviderService;

    this.registerKartonHandlers();

    // Create an empty default agent
    this.createAgent(AgentTypes.CHAT);
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
      'agents.updateInputState',
      async (
        _callingClientId: string,
        instanceId: string,
        inputString: string,
      ) => {
        await this.updateInputState(instanceId, inputString);
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
      'agents.getAgentsList',
      async (_callingClientId: string, offset: number, limit: number) => {
        return await this.getAgentsList(offset, limit);
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
  ): Promise<InstanceType<(typeof AgentsMap)[TAgentType]>> {
    const agentInstanceId = randomUUID();

    this.karton.setState((draft) => {
      draft.agents.instances[agentInstanceId] = {
        type: type,
        canSelectModel: AgentsMap[type].config.allowModelSelection,
        requiredModelCapabilities: AgentsMap[type].config.requiredCapabilities,
        allowUserInput: AgentsMap[type].config.allowUserInput,
        parentAgentInstanceId: parent?.parentInstanceId ?? null,
        childAgentInstanceIds: [],
        state: {
          title: '',
          isWorking: false,
          history: [],
          compactedHistory: undefined,
          lastCompactedMessageId: undefined,
          queuedMessages: [],
          activeModelId: 'claude-haiku-4-5',
          inputState: '',
          usedTokens: 0,
        },
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

        this.karton.setState((draft) => {
          draft.agents.instances[agentInstanceId].childAgentInstanceIds.push(
            childAgent.instanceId,
          );
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

  // Resume an agent form the last persisted state. Should probabyl be called when the user select the agent from a list of previous agents.
  public async resumeAgent(_instanceId: string) {
    // TODO: Fetch the agent from the persistence layer and recreate the agent with the given instance id and state.
  }

  private async persistAgentState(_instanceId: string) {
    // Store agent state into DB.
    // TODO: Implement this.
  }

  private async deleteAgent(instanceId: string) {
    const agent = this.activeAgents.get(instanceId);

    if (!agent) {
      throw new Error(`Agent with instance id ${instanceId} not found`);
    }

    await agent.stop();

    // Make sure to let the agent finish tool return with a failure so that a potential parent understands that the agent was deleted.
    await agent.reportErrorToParent(
      new Error("Agent was stopped and deleted before finishing it's task."),
    );

    // Delete all child agents as well. Do this recursively.
    for (const childAgentInstanceId of this.karton.state.agents.instances[
      instanceId
    ].childAgentInstanceIds) {
      await this.deleteAgent(childAgentInstanceId);
    }

    // Clear the agent from the parents child agent list.
    this.karton.setState((draft) => {
      const parentAgentInstanceId =
        this.karton.state.agents.instances[instanceId].parentAgentInstanceId;
      if (parentAgentInstanceId) {
        draft.agents.instances[parentAgentInstanceId].childAgentInstanceIds =
          draft.agents.instances[
            parentAgentInstanceId
          ].childAgentInstanceIds.filter(
            (childAgentInstanceId) => childAgentInstanceId !== instanceId,
          );
      }
    });

    // Clear the karton state of the agent.
    this.karton.setState((draft) => {
      delete draft.agents.instances[instanceId];
    });

    // Clear the active agents map.
    this.activeAgents.delete(instanceId);

    // Clear the agent from persistence layer.
    // TODO: Implement this.
  }

  /**
   * Stops an agent and closes it's active instance - must be resumed when it should be opened again.
   * @param instanceId The agent instance that should be archived (stopped and only persistence kept)
   */
  private async archiveAgent(instanceId: string) {
    // Stop this agent and all child agents
    const agent = this.activeAgents.get(instanceId);

    if (!agent) {
      throw new Error(`Agent with instance id ${instanceId} not found`);
    }

    await agent.stop();

    // Make sure to let the agent finish tool return with a failure so that a potential parent understands that the agent was deleted.
    await agent.reportErrorToParent(
      new Error("Agent was stopped and deleted before finishing it's task."),
    );
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

    const childAgents =
      this.karton.state.agents.instances[instanceId].childAgentInstanceIds;

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

  private async getAgentsList(_offset: number, _limit: number) {
    // TODO: Implement this
    return [];
  }
}
