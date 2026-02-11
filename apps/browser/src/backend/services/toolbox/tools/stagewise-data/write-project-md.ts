import { tool } from 'ai';
import { writeProjectMdToolInputSchema } from '@shared/karton-contracts/ui/agent/tools/types';
import {
  PROJECT_MD_FILENAME,
  PROJECT_MD_DIR,
} from '@/agents/shared/prompts/utils/read-project-md';
import fs from 'node:fs/promises';
import path from 'node:path';

export const DESCRIPTION = `Write or update the PROJECT.md project analysis file.

This file is stored in the user's project at .stagewise/PROJECT.md.
Use this tool to save your project analysis after gathering information about the codebase.

Parameters:
- content (string, REQUIRED): The complete PROJECT.md content to write.`;

/**
 * Write PROJECT.md tool
 * Writes the project analysis file to the user's project at .stagewise/PROJECT.md.
 *
 * @param workspacePath The path to the user's workspace/project root
 */
export const writeProjectMdTool = (workspacePath: string) =>
  tool({
    description: DESCRIPTION,
    inputSchema: writeProjectMdToolInputSchema,
    execute: async ({ content }) => {
      try {
        // Ensure the .stagewise directory exists
        const projectMdDir = path.join(workspacePath, PROJECT_MD_DIR);
        await fs.mkdir(projectMdDir, { recursive: true });

        const filePath = path.join(projectMdDir, PROJECT_MD_FILENAME);

        // Write the file
        await fs.writeFile(filePath, content, 'utf-8');

        return {
          success: true,
          message: 'PROJECT.md written successfully',
          path: filePath,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          message: `Failed to write PROJECT.md: ${errorMessage}`,
          path: '',
        };
      }
    },
  });
