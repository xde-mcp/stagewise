import { BaseAgent } from '../shared/base-agent';
import { AgentTypes } from '@shared/karton-contracts/ui/agent';
import type { StagewiseToolSet } from '@shared/karton-contracts/ui/agent/tools/types';
import { buildChatSystemPrompt } from './context-builder/context-builder';
import { z } from 'zod';

export const chatAgentFinishToolOutputSchema = z.object({ type: z.string() });

export class ChatAgent extends BaseAgent<
  typeof chatAgentFinishToolOutputSchema,
  undefined
> {
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
    allowUserInput: true,
    generateTitles: true,
    finishToolOutputSchema: chatAgentFinishToolOutputSchema,
    updateTitlesEveryNUserMessages: 5,
  };

  protected getSystemPrompt = async (): Promise<string> => {
    return buildChatSystemPrompt(this.toolbox, this.instanceId);
  };

  protected getTools = async () => {
    const id = this.instanceId;
    const box = this.toolbox;
    const tools = {
      executeConsoleScriptTool: await box.getTool(
        'executeConsoleScriptTool',
        id,
      ),
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
