import { BaseAgent, type BaseAgentConfig } from '../shared/base-agent';
import { AgentTypes } from '@shared/karton-contracts/ui/agent';
import type { StagewiseToolSet } from '@shared/karton-contracts/ui/agent/tools/types';
import { z } from 'zod';
import systemPrompt from './system-prompt.md?raw';

const finishToolOutputSchema = z.object({
  message: z.string(),
});

export class WorkspaceMdAgent extends BaseAgent<
  typeof finishToolOutputSchema,
  | { updateReason: string; mountPrefix: string; parentAgentInstanceId: string }
  | undefined
> {
  public static readonly agentType = AgentTypes.WORKSPACE_MD;
  public static readonly config = {
    persistent: false, // Background task, no persistence needed
    defaultModelId: 'claude-haiku-4-5' as const,
    allowModelSelection: false, // Fixed model for consistency
    requiredCapabilities: {
      inputModalities: {
        text: true,
        image: false,
        video: false,
        audio: false,
        file: false,
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
        canCode: false, // Only analyzing, not writing code
      },
    },
    allowUserInput: false, // Autonomous agent - no user input
    generateTitles: false, // Background task - no title needed
    finishToolOutputSchema: finishToolOutputSchema,
    maxRetries: 2, // Retry on failure
  } satisfies BaseAgentConfig<typeof finishToolOutputSchema>;

  protected getSystemPrompt = async (): Promise<string> => {
    return systemPrompt;
  };

  protected async onCreated(): Promise<void> {
    const reason = this.instanceConfig?.updateReason;
    const parentMounts = this.toolbox.getMountedPathsForAgent(
      this.instanceConfig?.parentAgentInstanceId ?? '',
    );
    const mountPrefix = this.instanceConfig?.mountPrefix;
    const path = parentMounts.get(mountPrefix ?? '');
    if (!path)
      throw new Error(
        `Mount ${mountPrefix} not found for agent ${this.instanceConfig?.parentAgentInstanceId ?? ''}`,
      );
    await this.toolbox.handleMountWorkspace(this.instanceId, path);

    const workspaceMdEntries = await this.toolbox.getWorkspaceMd(
      this.instanceId,
    );

    const workspaceMdParts = workspaceMdEntries
      .map(
        (e) =>
          `<file path="${e.mountPrefix}/.stagewise/WORKSPACE.md">${e.content}</file>`,
      )
      .join('\n');

    await this.sendUserMessage({
      id: '',
      role: 'user',
      parts: [
        {
          type: 'text',
          text: `
${reason ? `Update the file \`.stagewise/WORKSPACE.md\`. You need to update because of the following reason: ${reason}` : 'Generate a new file `.stagewise/WORKSPACE.md` after analyzing the project.'}

${workspaceMdParts}`.trim(),
        },
      ],
    });
  }

  protected getTools = async () => {
    const id = this.instanceId;
    const box = this.toolbox;
    const tools = {
      readFileTool: await box.getTool('readFileTool', id),
      listFilesTool: await box.getTool('listFilesTool', id),
      globTool: await box.getTool('globTool', id),
      grepSearchTool: await box.getTool('grepSearchTool', id),
      overwriteFileTool: await box.getTool('overwriteFileTool', id),
      multiEditTool: await box.getTool('multiEditTool', id),
    };
    // Filter out null tools that miss dependencies in the toolbox
    return Object.fromEntries(
      Object.entries(tools).filter(([_, tool]) => tool !== null),
    ) as Partial<StagewiseToolSet>;
  };
}
