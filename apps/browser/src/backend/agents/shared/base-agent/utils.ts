import {
  type ModelMessage,
  generateText,
  convertToModelMessages,
  type UserModelMessage,
  type ToolSet,
} from 'ai';
import type { AgentMessage } from '@shared/karton-contracts/ui/agent';
import type { SelectedElement } from '@shared/selected-elements';
import type { ModelProviderService } from '@/agents/model-provider';
import {
  relevantCodebaseFilesToContextSnippet,
  selectedElementToContextSnippet,
} from '../prompts/utils/metadata-converter/html-elements';
import { textClipToContextSnippet } from '../prompts/utils/metadata-converter/text-clips';
import xml from 'xml';
import specialTokens from '../prompts/utils/special-tokens';

/**
 * Strip all underscore-prefixed properties from a tool output object.
 * This allows tool implementations to attach UI-only metadata (e.g. `_diff`)
 * that is visible in the UI but automatically excluded from model context.
 */
function stripUnderscoreProperties(
  output: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(output).filter(([key]) => !key.startsWith('_')),
  );
}

/**
 * Converts a set of UI messages to model messages that then can simply be used to trigger a LLM.
 *
 * We implement this function to integrate handling for our custom formatting of file references etc.
 *
 * @param messages Messages that should be converted to model messages.
 * @param systemPrompt The  system prompt to prepend to the messages.
 * @returns Model messages that represent the input messages.
 */
export const convertStagewiseUIToModelMessages = async (
  messages: AgentMessage[],
  systemPrompt: string,
  tools: ToolSet,
): Promise<ModelMessage[]> => {
  const modelMessages: ModelMessage[] = [];

  // Add system prompt first if provided
  if (systemPrompt) {
    modelMessages.push({ role: 'system', content: systemPrompt });
  }

  // Convert each UI message to model message format
  for (const message of messages) {
    if (message.role !== 'user') {
      // Strip underscore-prefixed properties (e.g. _diff) from tool outputs
      // before converting to model messages - these are UI-only metadata
      const cleanedMessage = {
        ...message,
        parts: message.parts.map((part) => {
          if (
            (part.type.startsWith('tool-') || part.type === 'dynamic-tool') &&
            'output' in part &&
            part.output &&
            typeof part.output === 'object'
          ) {
            return {
              ...part,
              output: stripUnderscoreProperties(
                part.output as Record<string, unknown>,
              ),
            };
          }
          return part;
        }),
      };
      modelMessages.push(
        ...(await convertToModelMessages([cleanedMessage], {
          tools: tools,
        })),
      );
    } else {
      // Convert the message with the UI SDK, but do some post processing to convert metadata as well.

      const parts = message.parts.map((part) => {
        if (part.type === 'text')
          return {
            ...part,
            text: xml({ 'user-msg': { _cdata: part.text } }),
          };
        return { ...part };
      });

      if ((message.metadata?.fileAttachments?.length || 0) > 0) {
        message.metadata?.fileAttachments?.forEach((f) => {
          // Determine hint based on whether file is supported
          const hint = f.validationError
            ? `This file could not be included: ${f.validationError}`
            : 'This attachment contains metadata about the file attachment. See next attachment for its content.';

          parts.push({
            type: 'text',
            text: xml({
              [specialTokens.userMsgAttachmentXmlTag]: {
                _attr: {
                  type: f.validationError ? 'unsupported-file' : 'file',
                  filename: f.fileName,
                  id: f.id,
                  hint,
                },
              },
            }),
          });

          // Only create FileUIPart if file is supported (no validation error)
          if (!f.validationError) {
            parts.push({
              type: 'file',
              url: f.url,
              mediaType: f.mediaType,
              filename: f.fileName,
            });
          }
        });
      }
      // convert file parts and text to model messages (without metadata) to ensure correct mapping of ui parts to model content
      const convertedMessage = (
        await convertToModelMessages([{ ...message, parts }])
      )[0]! as UserModelMessage;

      // If the content is a string, we convert it to a single text part because we always want a parts array as content.
      if (typeof convertedMessage.content === 'string') {
        convertedMessage.content = [
          {
            type: 'text',
            text: convertedMessage.content,
          },
        ];
      }

      const systemAttachmentTextPart: string[] = [];

      if (
        message.metadata?.rejectedEdits &&
        message.metadata.rejectedEdits.length > 0
      ) {
        systemAttachmentTextPart.push(
          `<${specialTokens.userMsgAttachmentXmlTag} type="rejected-edits" value="${message.metadata.rejectedEdits.join(',')}"/>`,
        );
      }

      // Handle text clip attachments - collapsed long text pasted by user
      // These are referenced in user message as @{id} and contain the full text content
      if (
        message.metadata?.textClipAttachments &&
        message.metadata.textClipAttachments.length > 0
      )
        message.metadata.textClipAttachments.forEach((textClip) => {
          systemAttachmentTextPart.push(textClipToContextSnippet(textClip));
        });

      if (
        message.metadata?.selectedPreviewElements &&
        message.metadata.selectedPreviewElements.length > 0
      ) {
        // We add max 5 context elements to the system attachment to avoid overwhelming the model with too much information.
        // TODO: Add this limitation to the UI as well as to not introduce situations where the user expects the LLM to see more.
        message.metadata.selectedPreviewElements
          .slice(0, 5)
          .forEach((element) => {
            systemAttachmentTextPart.push(
              selectedElementToContextSnippet(element as SelectedElement),
            );
          });

        // We add the relevant codebase files to the system attachment to provide the LLM with the codebase context.
        // We limit this to max 6 files to provide sufficient context for design cloning.
        systemAttachmentTextPart.push(
          relevantCodebaseFilesToContextSnippet(
            (message.metadata?.selectedPreviewElements ??
              []) as SelectedElement[],
            6,
          ),
        );
      }

      if (systemAttachmentTextPart.length > 0) {
        convertedMessage.content.push({
          type: 'text',
          text: systemAttachmentTextPart.join('\n'),
        });
      }

      modelMessages.push({
        role: 'user',
        content: convertedMessage.content,
      });
    }
  }

  return modelMessages;
};

export const capitalizeFirstLetter = (string: string): string => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

export const generateSimpleTitle = async (
  messages: AgentMessage[],
  modelProviderService: ModelProviderService,
  agentInstanceId: string,
): Promise<string> => {
  const modelWithOptions = modelProviderService.getModelWithOptions(
    'claude-haiku-4-5',
    `${agentInstanceId}_title`,
  );

  const messageList = messages
    .filter(
      (message) => message.role === 'user' || message.role === 'assistant',
    )
    .slice(-10)
    .map(
      (message) =>
        `${message.role}: ${message.parts.map((part) => (part.type === 'text' ? part.text.replace(/[\n\r]+/g, '  ').slice(0, 200) : `(ATTACHED ${part.type})`)).join(' ')}`,
    )
    .join('\n');

  const title = await generateText({
    model: modelWithOptions.model,
    providerOptions: {
      ...modelWithOptions.providerOptions,
      anthropic: { thinking: { type: 'disabled' } },
    },
    headers: modelWithOptions.headers,
    messages: [
      {
        role: 'system',
        content: `Summarize the current intention of the user into a very short and precise title with a maximum 7 words. Only output the short title, nothing else. Don't use markdown formatting. Output a single, raw, simple sentence. Don't mention "user" or "assistant". Write from the perspective of the user.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract a title for the user's current intent from the following conversation:\n<conversation>\n${messageList}\n</conversation>\n\nSummarize into a single short sentence.`,
          },
        ],
      },
    ],
    temperature: 0.3,
    maxOutputTokens: 100,
  }).then((result) => result.text);

  return title;
};

export const generateChatSummary = async (
  messages: AgentMessage[],
  modelProviderService: ModelProviderService,
  agentInstanceId: string,
): Promise<string> => {
  const modelWithOptions = modelProviderService.getModelWithOptions(
    'claude-haiku-4-5',
    `${agentInstanceId}_title`,
  );

  const inputHistory = messages
    .map((msg) => {
      return `**${msg.role}**:\n${msg.parts.map((part) => (part.type === 'text' ? part.text.replace(/[\n\r]+/g, '  ').slice(0, 200) : `(ATTACHED ${part.type})`)).join(' ')}`;
    })
    .join('\n\n');

  const title = await generateText({
    model: modelWithOptions.model,
    providerOptions: modelWithOptions.providerOptions,
    headers: modelWithOptions.headers,
    messages: [
      {
        role: 'system',
        content: `Summarize the given conversation into a focused summary that presveres all important information, including critical decisions, file paths, references, rules and other information. The goal is to persist all extraordinary information as well as regular information about the conversation. Always refer to the user as "user" and the assistant as "assistant". Only output the summary, no other text like titles or notes. Write one consistent high density summary. You may use simple markdown formatting to structure information better. Be more detailed with chat content that happened late in the conversation.`,
      },
      {
        role: 'user',
        content: inputHistory,
      },
    ],
    temperature: 0.1,
  }).then((result) => result.text);

  return title;
};
