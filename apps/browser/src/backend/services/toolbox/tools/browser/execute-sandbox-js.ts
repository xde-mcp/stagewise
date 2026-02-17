import {
  type ExecuteSandboxJsToolInput,
  executeSandboxJsToolInputSchema,
} from '@shared/karton-contracts/ui/agent/tools/types';
import { tool } from 'ai';
import { rethrowCappedToolOutputError } from '../../utils';
import { capToolOutput } from '../../utils';
import type { SandboxService } from '@/services/sandbox';

/* Due to an issue in zod schema conversion in the ai sdk,
   the schema descriptions are not properly used for the prompts -
   thus, we include them in the descriptions as well. */

export const DESCRIPTION = `Execute JavaScript in your persistent, sandboxed Node.js VM context.

Parameters:
- script (string, REQUIRED): JavaScript code to execute in the sandbox.
`;

export const executeSandboxJsTool = (
  sandboxService: SandboxService,
  agentInstanceId: string,
) => {
  return tool({
    description: DESCRIPTION,
    inputSchema: executeSandboxJsToolInputSchema,
    execute: async (params, options) => {
      const { toolCallId } = options as { toolCallId: string };
      // Set the tool call ID for this execution so file writes are tracked correctly
      sandboxService.setAgentToolCallId(agentInstanceId, toolCallId);
      try {
        return await executeSandboxJsToolExecute(
          params,
          agentInstanceId,
          sandboxService,
        );
      } finally {
        // Always clear the tool call ID after execution completes
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
    const value = await sandboxService.execute(agentInstanceId, params.script);

    // Convert result to string (execute() returns the raw script return value)
    const scriptResult =
      typeof value === 'string' ? value : JSON.stringify(value);

    return {
      message: 'Successfully executed sandbox JavaScript',
      result: capToolOutput(scriptResult),
    };
  } catch (error) {
    rethrowCappedToolOutputError(error);
  }
}
