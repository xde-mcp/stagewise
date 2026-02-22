import {
  type ExecuteSandboxJsToolInput,
  executeSandboxJsToolInputSchema,
} from '@shared/karton-contracts/ui/agent/tools/types';
import { tool } from 'ai';
import { rethrowCappedToolOutputError } from '../../utils';
import { capToolOutput } from '../../utils';
import type { SandboxService } from '@/services/sandbox';
import { validateAttachmentDataUrl } from '@shared/karton-contracts/ui/shared-types';
import type { FileAttachment } from '@shared/karton-contracts/ui/agent/metadata';

/* Due to an issue in zod schema conversion in the ai sdk,
   the schema descriptions are not properly used for the prompts -
   thus, we include them in the descriptions as well. */

export const DESCRIPTION = `Execute JavaScript in your persistent, sandboxed Node.js VM context.

Parameters:
- script (string, REQUIRED): JavaScript code to execute in the sandbox.
`;

function validateSandboxFileAttachment(attachment: {
  id: string;
  mediaType: string;
  fileName?: string;
  url: string;
}): FileAttachment {
  const result = validateAttachmentDataUrl(
    attachment.mediaType,
    attachment.url,
  );
  if (!result.valid) {
    return { ...attachment, validationError: result.error };
  }
  return { ...attachment };
}

export const executeSandboxJsTool = (
  sandboxService: SandboxService,
  agentInstanceId: string,
) => {
  return tool({
    description: DESCRIPTION,
    inputSchema: executeSandboxJsToolInputSchema,
    execute: async (params, options) => {
      const { toolCallId } = options as { toolCallId: string };
      sandboxService.setAgentToolCallId(agentInstanceId, toolCallId);
      try {
        const result = await executeSandboxJsToolExecute(
          params,
          agentInstanceId,
          sandboxService,
        );
        const fileWriteCount =
          sandboxService.getAndClearFileWriteCount(agentInstanceId);
        if (fileWriteCount > 0)
          return { ...result, _hasFileWrites: true as const };

        return result;
      } finally {
        sandboxService.clearAgentToolCallId(agentInstanceId);
      }
    },
  });
};

async function executeSandboxJsToolExecute(
  params: ExecuteSandboxJsToolInput,
  agentInstanceId: string,
  sandboxService: SandboxService,
) {
  try {
    const { value, outputs, customFileAttachments } =
      await sandboxService.execute(agentInstanceId, params.script);

    // Build the final result: API.output() entries in order, then the return value last
    const parts: string[] = [...outputs];
    if (value !== undefined && value !== null) {
      parts.push(typeof value === 'string' ? value : JSON.stringify(value));
    }
    const scriptResult = parts.join('\n');

    const validatedAttachments =
      customFileAttachments.length > 0
        ? customFileAttachments.map(validateSandboxFileAttachment)
        : undefined;

    return {
      message: 'Successfully executed sandbox JavaScript',
      result: capToolOutput(scriptResult),
      _customFileAttachments: validatedAttachments,
    };
  } catch (error) {
    rethrowCappedToolOutputError(error);
  }
}
