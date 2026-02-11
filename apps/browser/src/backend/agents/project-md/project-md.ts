import { BaseAgent, type BaseAgentConfig } from '../shared/base-agent';
import { AgentTypes } from '@shared/karton-contracts/ui/agent';
import type { StagewiseToolSet } from '@shared/karton-contracts/ui/agent/tools/types';
import { z } from 'zod';
import { buildProjectMdSystemPrompt } from './context-builder';
import { randomUUID } from 'node:crypto';

const finishToolOutputSchema = z.object({
  message: z.string(),
});

export class ProjectMdAgent extends BaseAgent<
  typeof finishToolOutputSchema,
  { updateReason: string } | undefined
> {
  public static readonly agentType = AgentTypes.PROJECT_MD;
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
    const reason = this.instanceConfig?.updateReason;
    return await buildProjectMdSystemPrompt(this.toolbox, reason);
  };

  protected async onCreated(): Promise<void> {
    const reason = this.instanceConfig?.updateReason;
    if (!reason) return;

    const projectMd = await this.toolbox.getProjectMd();
    const message = projectMd
      ? `The PROJECT.md file has already been generated. Update it with the following reason after analyzing the project again: ${reason}. \n\n The current content of the PROJECT.md file is: ${projectMd}`
      : `Generate a new PROJECT.md file after analyzing the project with the following reason: ${reason}`;

    await this.sendUserMessage({
      id: randomUUID(),
      role: 'user',
      parts: [
        {
          type: 'text',
          text: message,
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
      writeProjectMdTool: await box.getTool('writeProjectMdTool', id),
    };
    // Filter out null tools that miss dependencies in the toolbox
    return Object.fromEntries(
      Object.entries(tools).filter(([_, tool]) => tool !== null),
    ) as Partial<StagewiseToolSet>;
  };
}
