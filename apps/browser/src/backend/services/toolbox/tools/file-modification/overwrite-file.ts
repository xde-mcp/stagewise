import {
  type OverwriteFileToolInput,
  overwriteFileToolInputSchema,
} from '@shared/karton-contracts/ui/tools/types';
import type { ClientRuntimeNode } from '@stagewise/agent-runtime-node';
import { tool } from 'ai';
import { rethrowCappedToolOutputError } from '../../utils';

/* Due to an issue in zod schema conversion in the ai sdk,
   the schema descriptions are not properly used for the prompts -
   thus, we include them in the descriptions as well. */
export const DESCRIPTION = `Overwrite entire file content, creating the file if it does not exist.

Parameters:
- relative_path (string, REQUIRED): Relative file path to overwrite or create.
- content (string, REQUIRED): New content for the file. Leading/trailing markdown code block markers (\`\`\`) are automatically removed.

Behavior: Creates parent directories if needed. No size limit on file write itself.`;

/**
 * Overwrite file content tool
 * Replaces the entire content of a file with new content.
 * Creates directories as needed.
 *
 * Note: Diff-history tracking is handled by the ToolboxService wrapper.
 */
export async function overwriteFileToolExecute(
  params: OverwriteFileToolInput,
  clientRuntime: ClientRuntimeNode,
) {
  const { relative_path, content } = params;

  try {
    const absolutePath = clientRuntime.fileSystem.resolvePath(relative_path);

    // Check if file exists (for message)
    const fileExists = await clientRuntime.fileSystem.fileExists(absolutePath);

    // Clean up content - remove markdown code blocks if present
    let cleanContent = content;
    if (cleanContent.startsWith('```')) {
      const lines = cleanContent.split('\n');
      // Remove first line if it's a code block marker
      if (lines[0]?.trim().startsWith('```')) {
        lines.shift();
      }
      cleanContent = lines.join('\n');
    }
    if (cleanContent.endsWith('```')) {
      const lines = cleanContent.split('\n');
      // Remove last line if it's a code block marker
      if (lines[lines.length - 1]?.trim() === '```') {
        lines.pop();
      }
      cleanContent = lines.join('\n');
    }

    // Ensure directory exists
    const dir = clientRuntime.fileSystem.getDirectoryName(absolutePath);
    await clientRuntime.fileSystem.createDirectory(dir);

    // Write the file
    const writeResult = await clientRuntime.fileSystem.writeFile(
      absolutePath,
      cleanContent,
    );
    if (!writeResult.success)
      throw new Error(
        `Failed to write file: ${relative_path} - ${writeResult.message} - ${writeResult.error || ''}`,
      );

    // Build success message
    const action = fileExists ? 'updated' : 'created';
    const message = `Successfully ${action} file: ${relative_path}`;

    return {
      message,
    };
  } catch (error) {
    rethrowCappedToolOutputError(error);
  }
}

export const overwriteFileTool = (clientRuntime: ClientRuntimeNode) =>
  tool({
    description: DESCRIPTION,
    inputSchema: overwriteFileToolInputSchema,
    execute: async (args) => {
      return overwriteFileToolExecute(args, clientRuntime);
    },
  });
