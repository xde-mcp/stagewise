import { BaseAgent, type BaseAgentConfig } from '../shared/base-agent';
import { AgentTypes } from '@shared/karton-contracts/ui/agent';
import type { StagewiseToolSet } from '@shared/karton-contracts/ui/agent/tools/types';
import { buildChatSystemPrompt } from './system-prompt-builder/system-prompt-builder';
import z from 'zod';
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
    },
    finishToolOutputSchema: undefined,
    allowUserInput: true,
    generateTitles: true,
    updateTitlesEveryNUserMessages: 5,
    historyCompressionThreshold: 0.5,
    minUncompressedMessages: 10, // We keep this relatively high to ensure we always have enough turns for full context for the agent
  } satisfies BaseAgentConfig<never>;

  protected getSystemPrompt = async (): Promise<string> => {
    return buildChatSystemPrompt(this.toolbox, this.instanceId);
  };

  protected getTools = async () => {
    const id = this.instanceId;
    const box = this.toolbox;
    const tools = {
      executeSandboxJsTool: await box.getTool('executeSandboxJsTool', id),
      listLibraryDocsTool: await box.getTool('listLibraryDocsTool', id),
      searchInLibraryDocsTool: await box.getTool('searchInLibraryDocsTool', id),
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
      askUserQuestionsTool: await box.getTool('askUserQuestionsTool', id),
      executeShellCommandTool: await box.getTool('executeShellCommandTool', id),
      // IMPORTANT: The type for this tool is defined in @apps/browser/src/shared/karton-contracts/ui/agent/tools/types.ts - update the type when you change this input schema.
      updateWorkspaceMdTool: this.getSpawnChildAgentTool(
        'Triggers an update of the `.stagewise/WORKSPACE.md` file. Use this whenever you find that the content of the file `.stagewise/WORKSPACE.md` in the system context is outdated or needs to be updated. Provide a brief reason for the update. Most importantly, provide the mount prefix of the workspace to update.',
        z.object({
          updateReason: z.string().min(5),
          mountPrefix: z.string().min(1),
        }),
        AgentTypes.WORKSPACE_MD,
        (input) => {
          return {
            updateReason: input.updateReason,
            mountPrefix: input.mountPrefix,
            parentAgentInstanceId: this.instanceId,
          };
        },
        'asynchronous',
      ),
    };
    // Filter out null tools that miss dependencies in the toolbox (e.g. no workspace connected)
    return Object.fromEntries(
      Object.entries(tools).filter(([_, tool]) => tool !== null),
    ) as Partial<StagewiseToolSet>;
  };
}
