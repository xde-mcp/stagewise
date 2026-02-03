import { BaseAgent, type BaseAgentConfig } from '../shared/base-agent';
import { AgentTypes } from '@shared/karton-contracts/ui/agent';
import type { ToolSet } from 'ai';

export class ChatAgent extends BaseAgent<never, ToolSet> {
  public static readonly agentType = AgentTypes.CHAT;
  public static readonly config: BaseAgentConfig<never> = {
    persistent: true,
    defaultModelId: 'claude-sonnet-4-5' as const,
    allowModelSelection: true,
    requiredCapabilities: {
      inputModalities: {
        text: true,
        image: true,
        video: false,
        audio: false,
        file: true,
      },
      outputModalities: {
        text: true,
        image: false,
        video: false,
        audio: false,
        file: false,
      },
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
    allowUserInput: true,
    generateTitles: true,
    finishToolOutputSchema: undefined,
  };

  protected getSystemPrompt = (): string => {
    return `You are a helpful little chatbot called "stage".`;
  };

  protected getTools = async () => {
    return {
      // grepSearch: await this.toolbox.getTool('grepSearchTool', this.instanceId),
      // updateStagewiseMd: await this.toolbox.getTool(
      //   'updateStagewiseMdTool',
      //   this.instanceId,
      // ),
      // TODO: Add more
    };
  };
}
