import type { UserMessage } from '@stagewise/agent-interface/agent';

export function parseUserMessageToPrompt(message: UserMessage) {
  return message.contentItems
    .map((item) => {
      return item.type === 'text' ? item.text : '';
    })
    .join('');
}
