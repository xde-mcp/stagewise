import {
  type ModelMessage,
  generateText,
  convertToModelMessages,
  type UserModelMessage,
  type ToolSet,
  type DynamicToolUIPart,
  type UserContent,
} from 'ai';
import type {
  AgentMessage,
  AgentToolUIPart,
} from '@shared/karton-contracts/ui/agent';
import type { FileAttachment } from '@shared/karton-contracts/ui/agent/metadata';
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
 * Collect all `_customFileAttachments` from tool part outputs on an
 * assistant message. These are multimodal attachments produced by the
 * sandbox during script execution that need to be injected as a
 * synthetic user message so the LLM can "see" them.
 */
function collectCustomFileAttachments(message: AgentMessage): FileAttachment[] {
  const attachments: FileAttachment[] = [];
  for (const part of message.parts) {
    if (
      (part.type.startsWith('tool-') || part.type === 'dynamic-tool') &&
      'output' in part &&
      part.output &&
      typeof part.output === 'object'
    ) {
      const output = part.output as Record<string, unknown>;
      const custom = output._customFileAttachments;
      if (Array.isArray(custom))
        attachments.push(...(custom as FileAttachment[]));
    }
  }
  return attachments;
}

/**
 * Build a synthetic `UserModelMessage` carrying multimodal file/image
 * parts for custom file attachments collected from sandbox tool outputs.
 * Follows the same validation-aware logic as normal user fileAttachments.
 */
function buildSyntheticUserMessageForAttachments(
  attachments: FileAttachment[],
): UserModelMessage {
  const content: UserContent = [];

  for (const f of attachments) {
    const hint = f.validationError
      ? `This file could not be included: ${f.validationError}`
      : 'This attachment was produced by the sandbox. See next attachment for its content.';

    content.push({
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

    if (!f.validationError) {
      content.push({
        type: 'file',
        data: f.url,
        mediaType: f.mediaType,
        filename: f.fileName,
      });
    }
  }

  return { role: 'user', content };
}

/**
 * Converts a set of UI messages to model messages that then can simply be used to trigger a LLM.
 *
 * We implement this function to integrate handling for our custom formatting of file references etc.
 *
 * @param messages Messages that should be converted to model messages.
 * @param systemPrompt The  system prompt to prepend to the messages.
 * @param tools The tools to use for the conversation.
 * @param minUncompressedCount The minimum number of uncompacted messages to keep in the conversation.
 *
 * @returns Model messages that represent the input messages.
 */
export const convertAgentMessagesToModelMessages = async (
  messages: AgentMessage[],
  systemPrompt: string,
  tools: ToolSet,
  minUncompressedCount: number,
): Promise<ModelMessage[]> => {
  // We work backwards first because this makes it easier to apply compacted conversation later on.
  // Every chunk is a turn of the conversation. We later flatten it. We store each chunk individually because some UI messages result in multiple model messages that need to have correct order.
  const revertedModelMessageChunks: ModelMessage[][] = [];

  // Convert each UI message to model message format
  for (let msgIndex = messages.length - 1; msgIndex >= 0; msgIndex--) {
    const message = messages[msgIndex];

    if (message.role !== 'user') {
      // Extract _customFileAttachments BEFORE stripping underscore props
      const customAttachments = collectCustomFileAttachments(message);

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

      // If there are custom file attachments, push a synthetic user
      // message BEFORE the assistant chunk (reverse order -- after
      // .reverse() the final order will be: assistant -> synthetic user).
      if (customAttachments.length > 0)
        revertedModelMessageChunks.push([
          buildSyntheticUserMessageForAttachments(customAttachments),
        ]);

      revertedModelMessageChunks.push(
        await convertToModelMessages([cleanedMessage], {
          tools: tools,
        }),
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

      revertedModelMessageChunks.push([
        {
          role: 'user',
          content: convertedMessage.content,
        },
      ]);
    }

    // if the message has compacted chat history, we append it to the model messages history as well and cancel the conversation of all following messages
    const reverseMsgCount = messages.length - msgIndex;
    if (
      minUncompressedCount <= reverseMsgCount &&
      message.metadata?.compressedHistory !== undefined
    ) {
      const compressedConversationHistory = xml({
        'compressed-conversation-history': {
          _cdata: message.metadata.compressedHistory,
        },
      });
      revertedModelMessageChunks.push([
        {
          role: 'user',
          content: [{ type: 'text', text: compressedConversationHistory }],
        },
      ]);
      break;
    }
  }

  if (systemPrompt) {
    revertedModelMessageChunks.push([
      { role: 'system', content: systemPrompt },
    ]);
  }

  const modelMessages = [...revertedModelMessageChunks].reverse().flat();

  return modelMessages;
};

const getSimpleToolsStateString = (
  toolPart: AgentToolUIPart | DynamicToolUIPart,
): string => {
  const state =
    toolPart.state === 'output-available'
      ? 'SUCCESS'
      : toolPart.state === 'output-error'
        ? 'ERROR'
        : toolPart.state === 'approval-requested'
          ? 'PENDING'
          : toolPart.state === 'approval-responded'
            ? toolPart.approval?.approved
              ? 'APPROVED'
              : 'REJECTED'
            : 'UNKNOWN';
  return state;
};

/**
 * Converts a set of UI messages to a compact string representation of the chat history.
 *
 * Can be used to generate titles or compact the chat history etc.
 *
 * @param messages Messages that should be converted to the compact string representation.
 *
 * @returns A compact string representation of the chat history.
 */
export const convertAgentMessagesToCompactMessageHistoryString = (
  messages: AgentMessage[],
): string => {
  // We work backwards first because this makes it easier to apply compacted conversation later on.
  const revertedCompactedHistoryStringParts: string[] = [];

  // Convert each UI message to model message format
  for (let msgIndex = messages.length - 1; msgIndex >= 0; msgIndex--) {
    const message = messages[msgIndex];

    if (message.role === 'assistant') {
      const serializedParts = message.parts
        .map((part) => {
          if (part.type === 'text') {
            return part.text.replace(/[\n\r]+/g, '  ').slice(0, 200);
          } else if (part.type === 'file') {
            return `[ATTACHED FILE: Name:'${part.filename}', Type:'${part.mediaType}']`;
          } else if (part.type.startsWith('tool-')) {
            const toolPart = part as AgentToolUIPart;
            return `[TOOL CALL: Type:'${toolPart.type.split('-').pop()}', State:'${getSimpleToolsStateString(toolPart)}']`;
          } else if (part.type === 'dynamic-tool') {
            const dynamicToolPart = part as DynamicToolUIPart;
            return `[ATTACHED DYNAMIC TOOL: Name:'${dynamicToolPart.toolName}', State:'${getSimpleToolsStateString(dynamicToolPart)}']`;
          }
          return undefined;
        })
        .filter((part) => part !== undefined);

      revertedCompactedHistoryStringParts.push(
        `**Assistant:** ${serializedParts.join(' ')}`,
      );
    } else if (message.role === 'user') {
      const serializedParts = message.parts
        .map((part) => {
          if (part.type === 'text') {
            return part.text.replace(/[\n\r]+/g, '  ').slice(0, 500);
          }
          return undefined;
        })
        .filter((part) => part !== undefined);

      const serializedFileAttachmentMetadataParts =
        message.metadata?.fileAttachments?.map((f) => {
          return `[ATTACHED FILE: ID:'${f.id}', Name:'${f.fileName}', Type:'${f.mediaType}']`;
        });
      const serializedTextClipAttachmentMetadataParts =
        message.metadata?.textClipAttachments?.map((tc) => {
          return `[ATTACHED TEXT CLIP: ID:'${tc.id}', Name:'${tc.label}', Length:'${tc.content.length}']`;
        });
      const serializedSelectedPreviewElementsMetadataParts =
        message.metadata?.selectedPreviewElements?.map((se) => {
          return `[ATTACHED SELECTED ELEMENT: ID:'${se.id}', TagName:'${se.tagName}', TextContent:'${se.textContent}']`;
        });

      revertedCompactedHistoryStringParts.push(
        `**User:** ${serializedParts.join(' ')} ${serializedFileAttachmentMetadataParts?.join(' ') ?? ''} ${serializedTextClipAttachmentMetadataParts?.join(' ') ?? ''} ${serializedSelectedPreviewElementsMetadataParts?.join(' ') ?? ''}`.trim(),
      );

      if (message.metadata?.compressedHistory) {
        revertedCompactedHistoryStringParts.push(
          `**PREVIOUSLY COMPACTED CHAT HISTORY:** ${message.metadata.compressedHistory.replace(/[\n\r]+/g, '  ').slice(0, 500)}`,
        );
        break;
      }
    }
  }

  return [...revertedCompactedHistoryStringParts].reverse().join('\n');
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
    providerOptions: {
      ...modelWithOptions.providerOptions,
      anthropic: { thinking: { type: 'disabled' } },
    },
    headers: modelWithOptions.headers,
    messages: [
      {
        role: 'system',
        content: `Summarize the current intention of the user into a very short and precise title with a maximum of 7 words. Only output the short title, nothing else. Don't use markdown formatting. Output a single, raw, simple sentence. Don't mention "user" or "assistant". Write from the perspective of the user.`,
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

export const generateSimpleCompressedHistory = async (
  messages: AgentMessage[],
  modelProviderService: ModelProviderService,
  agentInstanceId: string,
): Promise<string> => {
  const modelWithOptions = modelProviderService.getModelWithOptions(
    'claude-haiku-4-5',
    `${agentInstanceId}`,
    {
      $ai_span_name: 'history-compression',
      $ai_parent_id: `${agentInstanceId}`,
    },
  );

  // Use the minimalistic model message conversion to get the chat we should actually summarize.
  const compactConvertedChatHistory =
    convertAgentMessagesToCompactMessageHistoryString(messages);

  const compactionResult = await generateText({
    model: modelWithOptions.model,
    providerOptions: modelWithOptions.providerOptions,
    headers: modelWithOptions.headers,
    messages: [
      {
        role: 'system',
        content: `Summarize the given conversation into a focused summary that presveres all important information, including critical decisions, file paths, references, rules and other information. Include information about discussions between user and assistant as well as findings the assistant made. The goal is to persist all extraordinary information as well as regular information about the conversation. Always refer to the user as "user" and the assistant as "assistant". Only output the summary, no other text like titles or notes. Write one consistent high density summary. You may use simple markdown formatting to structure information better. Be more detailed with chat content that happened late in the conversation.`,
      },
      {
        role: 'user',
        content: [{ type: 'text', text: compactConvertedChatHistory }],
      },
    ],
    temperature: 0.1,
    maxOutputTokens: 10000,
  }).then((result) => result.text);

  return compactionResult;
};
