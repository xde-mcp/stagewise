import type { ClientRuntime } from '@stagewise/agent-runtime-interface';
import { z } from 'zod';

export const DESCRIPTION = 'Delete a file from the file system';

export const deleteFileParamsSchema = z.object({
  path: z.string().describe('Relative file path to delete'),
});

export type DeleteFileParams = z.infer<typeof deleteFileParamsSchema>;

const toolResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
});

type ToolResult = z.infer<typeof toolResultSchema>;

/**
 * Delete file tool
 * Removes a file from the file system.
 * Returns an error if the file doesn't exist or cannot be deleted.
 */
export async function deleteFileTool(
  params: DeleteFileParams,
  clientRuntime: ClientRuntime,
): Promise<ToolResult> {
  const { path: relPath } = params;

  // Validate required parameters
  if (!relPath) {
    return {
      success: false,
      message: 'Missing required parameter: path',
      error: 'MISSING_PATH',
    };
  }

  try {
    const absolutePath = clientRuntime.fileSystem.resolvePath(relPath);

    // Check if file exists
    const fileExists = await clientRuntime.fileSystem.fileExists(absolutePath);
    if (!fileExists) {
      return {
        success: false,
        message: `File not found: ${relPath}`,
        error: 'FILE_NOT_FOUND',
      };
    }

    // Delete the file
    const deleteResult =
      await clientRuntime.fileSystem.deleteFile(absolutePath);
    if (!deleteResult.success) {
      return {
        success: false,
        message: `Failed to delete file: ${relPath}`,
        error: deleteResult.error || 'DELETE_ERROR',
      };
    }

    return {
      success: true,
      message: `Successfully deleted file: ${relPath}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to delete file: ${relPath}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
