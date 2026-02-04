import {
  type DeleteFileToolInput,
  deleteFileToolInputSchema,
} from '@shared/karton-contracts/ui/tools/types';
import type { ClientRuntimeNode } from '@stagewise/agent-runtime-node';
import { tool } from 'ai';
import { rethrowCappedToolOutputError } from '../../utils';

/* Due to an issue in zod schema conversion in the ai sdk,
   the schema descriptions are not properly used for the prompts -
   thus, we include them in the descriptions as well. */
export const DESCRIPTION = `Delete a file from the file system with undo capability.

Parameters:
- relative_path (string, REQUIRED): Relative file path to delete. Must be an existing file.

Behavior: Respects .gitignore. Throws error if file doesn't exist.`;

/**
 * Delete file tool
 * Removes a file from the file system.
 * Returns an error if the file doesn't exist or cannot be deleted.
 *
 * Note: Diff-history tracking is handled by the ToolboxService wrapper.
 */
export async function deleteFileToolExecute(
  params: DeleteFileToolInput,
  clientRuntime: ClientRuntimeNode,
) {
  const { relative_path } = params;

  try {
    const absolutePath = clientRuntime.fileSystem.resolvePath(relative_path);

    // Check if file exists
    const fileExists = await clientRuntime.fileSystem.fileExists(absolutePath);
    if (!fileExists) throw new Error(`File not found: ${relative_path}`);

    // Delete the file
    const deleteResult =
      await clientRuntime.fileSystem.deleteFile(absolutePath);
    if (!deleteResult.success)
      throw new Error(
        `Failed to delete file: ${relative_path} - ${deleteResult.message} - ${deleteResult.error || ''}`,
      );

    return {
      message: `Successfully deleted file: ${relative_path}`,
    };
  } catch (e) {
    rethrowCappedToolOutputError(e);
  }
}

export const deleteFileTool = (clientRuntime: ClientRuntimeNode) =>
  tool({
    description: DESCRIPTION,
    inputSchema: deleteFileToolInputSchema,
    execute: async (args) => {
      return deleteFileToolExecute(args, clientRuntime);
    },
  });
