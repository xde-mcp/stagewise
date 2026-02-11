import { BaseAgent, type BaseAgentConfig } from '../shared/base-agent';
import { AgentTypes } from '@shared/karton-contracts/ui/agent';
import type { StagewiseToolSet } from '@shared/karton-contracts/ui/agent/tools/types';
import { buildChatSystemPrompt } from './context-builder/context-builder';
export class ChatAgent extends BaseAgent<never, undefined> {
  public static readonly agentType = AgentTypes.CHAT;
  public static readonly config = {
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
    finishToolOutputSchema: undefined,
    allowUserInput: true,
    generateTitles: true,
    updateTitlesEveryNUserMessages: 5,
  } satisfies BaseAgentConfig<never>;

  protected getSystemPrompt = async (): Promise<string> => {
    return buildChatSystemPrompt(this.toolbox, this.instanceId);
  };

  protected getTools = async () => {
    const id = this.instanceId;
    const box = this.toolbox;
    const tools = {
      executeSandboxJsTool: await box.getTool('executeSandboxJsTool', id),
      resolveContext7LibraryTool: await box.getTool(
        'resolveContext7LibraryTool',
        id,
      ),
      getContext7LibraryDocsTool: await box.getTool(
        'getContext7LibraryDocsTool',
        id,
      ),
      getLintingDiagnosticsTool: await box.getTool(
        'getLintingDiagnosticsTool',
        id,
      ),
      deleteFileTool: await box.getTool('deleteFileTool', id),
      overwriteFileTool: await box.getTool('overwriteFileTool', id),
      readFileTool: await box.getTool('readFileTool', id),
      listFilesTool: await box.getTool('listFilesTool', id),
      globTool: await box.getTool('globTool', id),
      multiEditTool: await box.getTool('multiEditTool', id),
      grepSearchTool: await box.getTool('grepSearchTool', id),
      readConsoleLogsTool: await box.getTool('readConsoleLogsTool', id),
    };
    // Filter out null tools that miss dependencies in the toolbox (e.g. no workspace connected)
    return Object.fromEntries(
      Object.entries(tools).filter(([_, tool]) => tool !== null),
    ) as Partial<StagewiseToolSet>;
  };
}
