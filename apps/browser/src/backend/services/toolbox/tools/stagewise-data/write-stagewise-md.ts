import { tool } from 'ai';
import { writeStagewiseMdToolInputSchema } from '@shared/karton-contracts/ui/agent/tools/types';
import { STAGEWISE_MD_FILENAME } from '@/agents/shared/prompts/utils/read-stagewise-md';
import fs from 'node:fs/promises';
import path from 'node:path';

export const DESCRIPTION = `Write or update the STAGEWISE.md project analysis file.

This file is stored in the stagewise-managed data directory, NOT in the user's project.
Use this tool to save your project analysis after gathering information about the codebase.

Parameters:
- content (string, REQUIRED): The complete STAGEWISE.md content to write.`;

/**
 * Write STAGEWISE.md tool
 * Writes the project analysis file to the stagewise-managed data directory.
 * This is separate from the user's codebase - it's internal stagewise data.
 *
 * @param stagewiseDataPath The path to the stagewise data directory for the workspace
 */
export const writeStagewiseMdTool = (stagewiseDataPath: string) =>
  tool({
    description: DESCRIPTION,
    inputSchema: writeStagewiseMdToolInputSchema,
    execute: async ({ content }) => {
      try {
        // Ensure the directory exists
        await fs.mkdir(stagewiseDataPath, { recursive: true });

        const filePath = path.join(stagewiseDataPath, STAGEWISE_MD_FILENAME);

        // Write the file
        await fs.writeFile(filePath, content, 'utf-8');

        return {
          success: true,
          message: 'STAGEWISE.md written successfully',
          path: filePath,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          message: `Failed to write STAGEWISE.md: ${errorMessage}`,
          path: '',
        };
      }
    },
  });
