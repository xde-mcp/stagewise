import { generateText } from 'ai';
import type { AgentMessage } from '@shared/karton-contracts/ui/agent';
import {
  type ModelProviderService,
  deepMergeProviderOptions,
} from '@/agents/model-provider';

export const generateSimpleTitle = async (
  messages: AgentMessage[],
  modelProviderService: ModelProviderService,
  agentInstanceId: string,
): Promise<string> => {
  const modelWithOptions = modelProviderService.getModelWithOptions(
    'claude-haiku-4-5',
    `${agentInstanceId}`,
    {
      $ai_span_name: 'title-generation',
      $ai_parent_id: agentInstanceId,
    },
  );

  const messageList = messages
    .filter(
      (message) => message.role === 'user' || message.role === 'assistant',
    )
    .slice(-10)
    .map((message) =>
      `${message.role}: ${message.parts.map((part) => (part.type === 'text' ? part.text.replace(/[\n\r]+/g, '  ').slice(0, 200) : `(ATTACHED ${part.type})`)).join(' ')}`.slice(
        0,
        500,
      ),
    )
    .join('\n');

  const title = await generateText({
    model: modelWithOptions.model,
    providerOptions: deepMergeProviderOptions(
      modelWithOptions.providerOptions,
      { anthropic: { thinking: { type: 'disabled' } } },
    ),
    headers: modelWithOptions.headers,
    messages: [
      {
        role: 'system',
        content:
          'Summarize the current intention of the user into a very short and precise title with a maximum of 7 words. Only output the short title, nothing else. Don\'t use markdown formatting. Output a single, raw, simple sentence. Don\'t mention "user" or "assistant". Write from the perspective of the user.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `<conversation>${messageList}</conversation> Generate a short title for this conversation.`,
          },
        ],
      },
    ],
    temperature: 0.15,
    maxOutputTokens: 100,
  }).then((result) => result.text);

  return title;
};
