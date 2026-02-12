import type { UIMessagePart, ReasoningUIPart, UIDataTypes } from 'ai';
import type { AgentMessage } from '@shared/karton-contracts/ui/agent';
import type { UIAgentTools } from '@shared/karton-contracts/ui/agent/tools/types';
import type { AgentToolUIPart } from '@shared/karton-contracts/ui/agent';

export function isToolPart(
  part: UIMessagePart<UIDataTypes, UIAgentTools>,
): part is AgentToolUIPart {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-');
}

export function isToolOrReasoningPart(
  part: UIMessagePart<UIDataTypes, UIAgentTools>,
): part is AgentToolUIPart | ReasoningUIPart {
  return (
    part.type === 'dynamic-tool' ||
    part.type.startsWith('tool-') ||
    part.type === 'reasoning'
  );
}

/**
 * Check if an assistant message is "empty" (no visible content yet).
 * Used to determine if we should show the "Working..." indicator.
 */
export function isEmptyAssistantMessage(msg: AgentMessage): boolean {
  // If it has any tools or files, it's not empty
  if (
    msg.parts
      .map((part) => part.type)
      .some(
        (type) =>
          type === 'dynamic-tool' ||
          type.startsWith('tool-') ||
          type === 'file',
      )
  )
    return false;

  // Check if all text/reasoning parts are empty
  return msg.parts.every(
    (part) =>
      (part.type !== 'text' && part.type !== 'reasoning') ||
      ((part.type === 'text' || part.type === 'reasoning') &&
        part.text.trim() === ''),
  );
}
