import { tool } from 'ai';
import { writeWorkspaceMdToolInputSchema } from '@shared/karton-contracts/ui/agent/tools/types';
import {
  WORKSPACE_MD_FILENAME,
  WORKSPACE_MD_DIR,
} from '@/agents/shared/prompts/utils/read-workspace-md';
import fs from 'node:fs/promises';
import path from 'node:path';

export const DESCRIPTION = `Write or update the  project analysis file.

This file is stored in the user's project at .stagewise/.
Use this tool to save your project analysis after gathering information about the codebase.

Parameters:
- content (string, REQUIRED): The complete  content to write.`;

/**
 * Write  tool
 * Writes the project analysis file to the user's project at .stagewise/.
 *
 * @param workspacePath The path to the user's workspace/project root
 */
export const writeWorkspaceMdTool = (workspacePath: string) =>
  tool({
    description: DESCRIPTION,
    inputSchema: writeWorkspaceMdToolInputSchema,
    execute: async ({ content }) => {
      try {
        // Ensure the .stagewise directory exists
        const workspaceMdDir = path.join(workspacePath, WORKSPACE_MD_DIR);
        await fs.mkdir(workspaceMdDir, { recursive: true });

        const filePath = path.join(workspaceMdDir, WORKSPACE_MD_FILENAME);

        // Write the file
        await fs.writeFile(filePath, content, 'utf-8');

        return {
          success: true,
          message: ' written successfully',
          path: filePath,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          message: `Failed to write : ${errorMessage}`,
          path: '',
        };
      }
    },
  });
