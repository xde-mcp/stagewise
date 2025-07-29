import type { ClientRuntime } from '@stagewise/agent-runtime-interface';
import { z } from 'zod';

export const DESCRIPTION =
  'Overwrite the entire content of a file. Creates the file if it does not exist, along with any necessary directories.';

export const overwriteFileParamsSchema = z.object({
  path: z.string().describe('Relative file path'),
  content: z.string(),
});

export type OverwriteFileParams = z.infer<typeof overwriteFileParamsSchema>;

const toolResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
});

type ToolResult = z.infer<typeof toolResultSchema>;

/**
 * Overwrite file content tool
 * Replaces the entire content of a file with new content.
 * Creates directories as needed.
 */
export async function overwriteFileTool(
  params: OverwriteFileParams,
  clientRuntime: ClientRuntime,
): Promise<ToolResult> {
  const { path: relPath, content } = params;

  // Validate required parameters
  if (!relPath) {
    return {
      success: false,
      message: 'Missing required parameter: path',
      error: 'MISSING_PATH',
    };
  }

  if (content === undefined) {
    return {
      success: false,
      message: 'Missing required parameter: content',
      error: 'MISSING_CONTENT',
    };
  }

  try {
    const absolutePath = clientRuntime.fileSystem.resolvePath(relPath);

    // Check if file exists
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
    if (!writeResult.success) {
      return {
        success: false,
        message: `Failed to write file: ${relPath}`,
        error: writeResult.error || 'WRITE_ERROR',
      };
    }

    // Build success message
    const action = fileExists ? 'updated' : 'created';
    const message = `Successfully ${action} file: ${relPath}`;

    return {
      success: true,
      message,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to overwrite file: ${relPath}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
