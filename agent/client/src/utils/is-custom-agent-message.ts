import { CustomAgentMessageId } from '@stagewise/karton-contract';
import type { ChatMessage } from '@stagewise/karton-contract';

export function isCustomAgentMessage(message: ChatMessage): boolean {
  return (Object.values(CustomAgentMessageId) as string[]).includes(message.id);
}
