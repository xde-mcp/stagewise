import type { Tools } from '@stagewise/agent-types';
import type { CoreMessage } from 'ai';

type Tool = Tools[keyof Tools];

export type ToolCallResult =
  | { error: false; userInteractionRequired: false; result: any }
  | { error: true; errorMessage: string }
  | {
      error: false;
      userInteractionRequired: true;
      userInteractionType: string;
      userInteractionParams: any;
    };

export async function handleClientsideToolCall(
  tool: Tool,
  toolCallId: string,
  messages: CoreMessage[],
  args: Tool['parameters'],
): Promise<ToolCallResult> {
  if (!isAutoToolCallAllowed(tool))
    return {
      error: false,
      userInteractionType: 'user-permission',
      userInteractionRequired: true,
      userInteractionParams: {},
    };
  if (tool.stagewiseMetadata?.runtime !== 'client')
    throw new Error('Tool is not clientside');
  if (!tool.execute)
    return {
      error: true,
      errorMessage: 'Client-side tool needs execute-function',
    };

  const result = await tool.execute(args, {
    toolCallId,
    messages,
  });

  return {
    error: false,
    userInteractionRequired: false,
    result,
  };
}

function isAutoToolCallAllowed(tool: Tool) {
  if (tool.stagewiseMetadata?.runtime === 'client') return true;
  else return false;
}
