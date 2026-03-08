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
import type { FullEnvironmentSnapshot } from '@shared/karton-contracts/ui/agent/metadata';
import type { SelectedElement } from '@shared/selected-elements';
import {
  computeAllEnvironmentChanges,
  resolveEffectiveSnapshot,
} from '../prompts/utils/environment-changes';
import {
  type ModelProviderService,
  deepMergeProviderOptions,
} from '@/agents/model-provider';
import {
  relevantCodebaseFilesToContextSnippet,
  selectedElementToContextSnippet,
} from '../prompts/utils/metadata-converter/html-elements';
import { textClipToContextSnippet } from '../prompts/utils/metadata-converter/text-clips';
import { mentionToContextSnippet } from '../prompts/utils/metadata-converter/mentions';
import xml from 'xml';
import specialTokens from '../prompts/utils/special-tokens';
import type { ModelCapabilities } from '@shared/karton-contracts/ui/shared-types';
import { findModelsAcceptingMime } from '@shared/available-models';

export type BlobReader = (
  agentId: string,
  attachmentId: string,
) => Promise<Buffer>;

export type BlobErrorReporter = (
  error: unknown,
  context: { operation: string; attachmentId: string },
) => void;

/**
 * Internal type for file attachments produced by the sandbox at runtime.
 * The sandbox writes binary data directly to the `att/` mount; this type
 * carries only metadata registered via `API.outputAttachment`.
 */
export interface SandboxFileAttachment {
  id: string;
  mediaType: string;
  fileName: string;
  sizeBytes: number;
}

import type { ModalityConstraint } from '@shared/karton-contracts/ui/shared-types';

const DEFAULT_IMAGE_CONSTRAINT: ModalityConstraint = {
  mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  maxBytes: 5_242_880, // 5 MB — conservative fallback
};

const DEFAULT_FILE_CONSTRAINT: ModalityConstraint = {
  mimeTypes: ['application/pdf'],
  maxBytes: 20_971_520, // 20 MB — conservative fallback
};

function formatMB(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

type ConstraintMatch =
  | { mime: true; size: true }
  | { mime: true; size: false; maxBytes: number }
  | { mime: false };

function checkConstraint(
  constraint: ModalityConstraint,
  mime: string,
  sizeBytes: number,
): ConstraintMatch {
  if (!constraint.mimeTypes.includes(mime)) return { mime: false };
  const base64Size = Math.ceil((sizeBytes * 4) / 3);
  if (base64Size <= constraint.maxBytes) return { mime: true, size: true };
  return { mime: true, size: false, maxBytes: constraint.maxBytes };
}

type AttachmentCheck =
  | { canConsume: true }
  | { canConsume: false; reason: string };

/**
 * Runtime check: can the current model consume this attachment as an
 * inline file part?  Uses per-model `inputConstraints` when available,
 * otherwise falls back to conservative defaults for image/file.
 * Video and audio require explicit constraints — no defaults.
 *
 * Returns a rejection reason when the attachment cannot be consumed.
 */
function canModelConsumeAttachment(
  capabilities: ModelCapabilities | undefined,
  mediaType: string,
  sizeBytes: number,
  currentModelId?: string,
): AttachmentCheck {
  if (!capabilities)
    return { canConsume: false, reason: 'Model capabilities unknown.' };
  const mime = mediaType.toLowerCase();
  const constraints = capabilities.inputConstraints;

  const modalityChecks: {
    name: string;
    enabled: boolean;
    constraint: ModalityConstraint | undefined;
  }[] = [
    {
      name: 'image',
      enabled: capabilities.inputModalities.image,
      constraint: constraints?.image ?? DEFAULT_IMAGE_CONSTRAINT,
    },
    {
      name: 'file',
      enabled: capabilities.inputModalities.file,
      constraint: constraints?.file ?? DEFAULT_FILE_CONSTRAINT,
    },
    {
      name: 'video',
      enabled: capabilities.inputModalities.video,
      constraint: constraints?.video,
    },
    {
      name: 'audio',
      enabled: capabilities.inputModalities.audio,
      constraint: constraints?.audio,
    },
  ];

  let sizeExceeded: { name: string; maxBytes: number } | undefined;

  for (const m of modalityChecks) {
    if (!m.enabled || !m.constraint) continue;
    const result = checkConstraint(m.constraint, mime, sizeBytes);
    if ('size' in result && result.size) return { canConsume: true };
    if ('size' in result && !result.size && !sizeExceeded)
      sizeExceeded = { name: m.name, maxBytes: result.maxBytes };
  }

  if (sizeExceeded) {
    return {
      canConsume: false,
      reason: `File too large for inline ${sizeExceeded.name} input (${formatMB(sizeBytes)} exceeds ~${formatMB(Math.floor((sizeExceeded.maxBytes * 3) / 4))} limit).`,
    };
  }

  const alternatives = findModelsAcceptingMime(mime, currentModelId);
  const altSuffix =
    alternatives.length > 0
      ? ` Models supporting ${mime}: ${alternatives.join(', ')}.`
      : '';

  const allSupported = modalityChecks
    .filter((m) => m.enabled && m.constraint)
    .flatMap((m) => m.constraint!.mimeTypes);

  if (allSupported.length > 0) {
    return {
      canConsume: false,
      reason: `This model doesn't support ${mime} inline.${altSuffix}`,
    };
  }

  return {
    canConsume: false,
    reason: `This model has no inline file input support.${altSuffix}`,
  };
}

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
function collectCustomFileAttachments(
  message: AgentMessage,
): SandboxFileAttachment[] {
  const attachments: SandboxFileAttachment[] = [];
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
        attachments.push(...(custom as SandboxFileAttachment[]));
    }
  }
  return attachments;
}

/**
 * Build a synthetic `UserModelMessage` carrying multimodal file/image
 * parts for custom file attachments collected from sandbox tool outputs.
 * Binary content is read from disk via the `att/` mount.
 */
async function buildSyntheticUserMessageForAttachments(
  attachments: SandboxFileAttachment[],
  agentInstanceId: string,
  blobReader: BlobReader,
  capabilities?: ModelCapabilities,
  onBlobError?: BlobErrorReporter,
  currentModelId?: string,
): Promise<UserModelMessage> {
  const content: UserContent = [];

  for (const f of attachments) {
    const check = canModelConsumeAttachment(
      capabilities,
      f.mediaType,
      f.sizeBytes,
      currentModelId,
    );
    const hint = check.canConsume
      ? 'Sandbox-produced attachment. See next part for inline content.'
      : `${check.reason} Access via fs.readFile('att/${f.id}') in the sandbox. To view inline, read it, resize/compress to a new file, then API.outputAttachment() the smaller copy.`;

    content.push({
      type: 'text',
      text: xml({
        [specialTokens.userMsgAttachmentXmlTag]: {
          _attr: {
            type: 'file',
            filename: f.fileName,
            id: f.id,
            hint,
          },
        },
      }),
    });

    if (check.canConsume) {
      try {
        const buf = await blobReader(agentInstanceId, f.id);
        content.push({
          type: 'file',
          data: new Uint8Array(buf),
          mediaType: f.mediaType,
          filename: f.fileName,
        });
      } catch (err) {
        onBlobError?.(err, {
          operation: 'readSandboxAttachmentBlob',
          attachmentId: f.id,
        });
      }
    }
  }

  return { role: 'user', content };
}

/**
 * Build a synthetic `UserModelMessage` carrying environment change
 * descriptions. Injected between adjacent messages whose environment
 * snapshots differ so the LLM sees what changed in the environment.
 */
export function buildSyntheticEnvironmentChangeMessage(
  changes: string[],
): UserModelMessage {
  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text: `<${specialTokens.environmentChangesXmlTag}>\n${changes.map((c) => `- ${c}`).join('\n')}\n</${specialTokens.environmentChangesXmlTag}>`,
      },
    ],
  };
}

/**
 * Converts a set of UI messages to model messages that then can simply be used to trigger a LLM.
 *
 * We implement this function to integrate handling for our custom formatting of file references etc.
 *
 * @param messages Messages that should be converted to model messages.
 * @param systemPrompt The system prompt to prepend to the messages.
 * @param tools The tools to use for the conversation.
 * @param minUncompressedCount The minimum number of uncompacted messages to keep in the conversation.
 * @param agentInstanceId The agent instance ID, used for computing environment change descriptions.
 * @param blobReader Reads attachment content from disk by agent+attachment ID.
 * @param modelCapabilities Current model's input capabilities for deciding file inclusion.
 * @param onBlobError Optional reporter for non-fatal blob read/write errors (telemetry).
 * @param liveSnapshot Optional live environment snapshot captured at the start of the current step.
 *        Compared against the last message's snapshot to inject a tail env-change without 1-step delay.
 *
 * @returns Model messages that represent the input messages.
 */
export const convertAgentMessagesToModelMessages = async (
  messages: AgentMessage[],
  systemPrompt: string,
  tools: ToolSet,
  minUncompressedCount: number,
  agentInstanceId: string,
  blobReader: BlobReader,
  modelCapabilities?: ModelCapabilities,
  onBlobError?: BlobErrorReporter,
  liveSnapshot?: FullEnvironmentSnapshot,
  currentModelId?: string,
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
          await buildSyntheticUserMessageForAttachments(
            customAttachments,
            agentInstanceId,
            blobReader,
            modelCapabilities,
            onBlobError,
            currentModelId,
          ),
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
        for (const f of message.metadata!.fileAttachments!) {
          const check = canModelConsumeAttachment(
            modelCapabilities,
            f.mediaType,
            f.sizeBytes,
            currentModelId,
          );
          const hint = check.canConsume
            ? 'User-attached file. See next part for inline content.'
            : `${check.reason} Access via fs.readFile('att/${f.id}') in the sandbox.`;

          parts.push({
            type: 'text',
            text: xml({
              [specialTokens.userMsgAttachmentXmlTag]: {
                _attr: {
                  type: 'file',
                  filename: f.fileName,
                  id: f.id,
                  hint,
                },
              },
            }),
          });

          if (check.canConsume) {
            try {
              const content = await blobReader(agentInstanceId, f.id);
              parts.push({
                type: 'file',
                url: content.toString('base64'),
                mediaType: f.mediaType,
                filename: f.fileName,
              });
            } catch (err) {
              onBlobError?.(err, {
                operation: 'readAttachmentBlob',
                attachmentId: f.id,
              });
            }
          }
        }
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

      if (message.metadata?.mentions && message.metadata.mentions.length > 0)
        message.metadata.mentions.forEach((mention) => {
          systemAttachmentTextPart.push(mentionToContextSnippet(mention));
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

    // Inject a synthetic env-change user message when the environment
    // snapshot changed between the previous message and this one.
    if (msgIndex > 0) {
      const currentEffective = resolveEffectiveSnapshot(messages, msgIndex);
      const previousEffective = resolveEffectiveSnapshot(
        messages,
        msgIndex - 1,
      );
      if (currentEffective && previousEffective) {
        const changes = computeAllEnvironmentChanges(
          previousEffective,
          currentEffective,
          agentInstanceId,
        );
        if (changes.length > 0) {
          revertedModelMessageChunks.push([
            buildSyntheticEnvironmentChangeMessage(changes),
          ]);
        }
      }
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

  // Inject a live env-change at the tail so the model sees changes that
  // happened since the last message was created (eliminates 1-step delay).
  if (liveSnapshot) {
    const lastEffective = resolveEffectiveSnapshot(
      messages,
      messages.length - 1,
    );
    if (lastEffective) {
      const liveChanges = computeAllEnvironmentChanges(
        lastEffective,
        liveSnapshot,
        agentInstanceId,
      );
      if (liveChanges.length > 0) {
        revertedModelMessageChunks.unshift([
          buildSyntheticEnvironmentChangeMessage(liveChanges),
        ]);
      }
    }
  }

  if (systemPrompt) {
    revertedModelMessageChunks.push([
      { role: 'system', content: systemPrompt },
    ]);
  }

  const modelMessages = [...revertedModelMessageChunks].reverse().flat();

  return addCacheControlBreakpoints(modelMessages);
};

/**
 * Cache-control provider options for native SDK providers.
 * Each SDK reads only its own key on message-level providerOptions.
 *
 * The `openaiCompatible` key is hardcoded in the SDK's message converter
 * (`getOpenAIMetadata`) and spread directly onto each message in the
 * request body — it does NOT use the custom provider name. This is how
 * `cache_control` reaches the stagewise gateway without any extra
 * transform logic.
 */
const CACHE_CONTROL_PROVIDER_OPTIONS = {
  anthropic: { cacheControl: { type: 'ephemeral' } },
  openaiCompatible: { cache_control: { type: 'ephemeral' } },
} satisfies Record<string, unknown>;

/**
 * Annotates up to 3 messages with Anthropic ephemeral cache control breakpoints:
 *
 * 1. The **first system message** — the system prompt is large and stable.
 * 2. The **last user message before the final block of assistant messages** —
 *    this is the pivot point where user context ends and agent output begins.
 * 3. The **last message overall** — ensures the tail of the conversation is cached.
 *
 * If any of these indices overlap (e.g. only 1 message), duplicates are
 * deduplicated so each message is annotated at most once.
 *
 * Non-Anthropic providers ignore unknown `providerOptions` keys, so this is
 * safe to apply unconditionally.
 */
function addCacheControlBreakpoints(messages: ModelMessage[]): ModelMessage[] {
  if (messages.length === 0) return messages;

  const indicesToCache = new Set<number>();

  // 1. First system message
  const firstSystemIndex = messages.findIndex((m) => m.role === 'system');
  if (firstSystemIndex !== -1) indicesToCache.add(firstSystemIndex);

  // 2. Last user message before the final contiguous block of assistant messages.
  //    Walk backwards: skip all trailing non-user messages that form the last
  //    assistant block, then find the first user message before that block.
  let pivotUserIndex = -1;
  let i = messages.length - 1;
  // Skip the trailing assistant/tool block (anything that isn't 'user' or 'system')
  while (i >= 0 && messages[i].role !== 'user') {
    i--;
  }
  // `i` now points at the last user message before the tail assistant block
  // (or -1 if there are no user messages).
  if (i >= 0) pivotUserIndex = i;
  if (pivotUserIndex !== -1) indicesToCache.add(pivotUserIndex);

  // 3. Last message overall
  indicesToCache.add(messages.length - 1);

  // Apply cache control to selected messages (mutate-free)
  return messages.map((message, idx) => {
    if (!indicesToCache.has(idx)) return message;
    return {
      ...message,
      providerOptions: deepMergeProviderOptions(
        CACHE_CONTROL_PROVIDER_OPTIONS,
        message.providerOptions,
      ),
    };
  });
}

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

const TOOL_PART_CHAR_CAP = 10_000;
const REASONING_CHAR_CAP = 2_000;

function capString(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n[...truncated]`;
}

function serializeToolPartForCompression(
  toolPart: AgentToolUIPart | DynamicToolUIPart,
): string {
  const toolName =
    toolPart.type === 'dynamic-tool'
      ? (toolPart as DynamicToolUIPart).toolName
      : toolPart.type.replace(/^tool-/, '');
  const state = getSimpleToolsStateString(toolPart);
  const id = toolPart.toolCallId;

  const lines: string[] = [
    `[TOOL CALL: Name:'${toolName}', ID:'${id}', State:'${state}']`,
  ];

  if (toolPart.input !== undefined) {
    const inputStr = JSON.stringify(toolPart.input);
    lines.push(`Input: ${capString(inputStr, TOOL_PART_CHAR_CAP)}`);
  }

  if (
    toolPart.state === 'output-available' &&
    'output' in toolPart &&
    toolPart.output !== undefined
  ) {
    const cleanedOutput =
      typeof toolPart.output === 'object' && toolPart.output !== null
        ? stripUnderscoreProperties(toolPart.output as Record<string, unknown>)
        : toolPart.output;
    const outputStr = JSON.stringify(cleanedOutput);
    lines.push(`Output: ${capString(outputStr, TOOL_PART_CHAR_CAP)}`);
  }

  if (
    toolPart.state === 'output-error' &&
    'errorText' in toolPart &&
    toolPart.errorText
  )
    lines.push(`Error: ${toolPart.errorText}`);

  return lines.join('\n');
}

/**
 * Converts a set of UI messages to a near-lossless string representation
 * of the chat history, suitable for LLM-based compression.
 *
 * @param messages Messages that should be converted to the string representation.
 *
 * @returns A detailed string representation of the chat history.
 */
export const convertAgentMessagesToCompactMessageHistoryString = (
  messages: AgentMessage[],
): string => {
  const revertedCompactedHistoryStringParts: string[] = [];

  for (let msgIndex = messages.length - 1; msgIndex >= 0; msgIndex--) {
    const message = messages[msgIndex];

    if (message.role === 'assistant') {
      const serializedParts = message.parts
        .map((part) => {
          if (part.type === 'text') {
            return part.text;
          } else if (part.type === 'reasoning') {
            return `[REASONING: ${capString(part.text, REASONING_CHAR_CAP)}]`;
          } else if (part.type === 'file') {
            return `[ATTACHED FILE: Name:'${part.filename}', Type:'${part.mediaType}']`;
          } else if (
            part.type.startsWith('tool-') ||
            part.type === 'dynamic-tool'
          ) {
            return serializeToolPartForCompression(
              part as AgentToolUIPart | DynamicToolUIPart,
            );
          }
          return undefined;
        })
        .filter((part) => part !== undefined);

      revertedCompactedHistoryStringParts.push(
        `**Assistant:**\n${serializedParts.join('\n')}`,
      );
    } else if (message.role === 'user') {
      const serializedParts = message.parts
        .map((part) => {
          if (part.type === 'text') {
            return part.text;
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
          return `[ATTACHED TEXT CLIP: ID:'${tc.id}', Name:'${tc.label}']\n${tc.content}`;
        });
      const serializedSelectedPreviewElementsMetadataParts =
        message.metadata?.selectedPreviewElements?.map((se) => {
          const details: Record<string, unknown> = {
            id: se.id,
            tagName: se.tagName,
            textContent: se.textContent,
            xpath: se.xpath,
            attributes: se.attributes,
          };
          if (se.codeMetadata?.length) {
            details.codeMetadata = se.codeMetadata.map((cm) => ({
              relation: cm.relation,
              relativePath: cm.relativePath,
              startLine: cm.startLine,
            }));
          }
          return `[SELECTED ELEMENT: ${capString(JSON.stringify(details), TOOL_PART_CHAR_CAP)}]`;
        });
      const serializedMentionParts = message.metadata?.mentions?.map((m) => {
        if (m.providerType === 'file')
          return `[MENTIONED FILE: Path:'${m.relativePath}'${m.isDirectory ? ', Directory' : ''}]`;
        return `[MENTIONED TAB: Handle:'${m.tabHandle}', URL:'${m.url}']`;
      });

      revertedCompactedHistoryStringParts.push(
        `**User:** ${serializedParts.join(' ')} ${serializedFileAttachmentMetadataParts?.join(' ') ?? ''} ${serializedTextClipAttachmentMetadataParts?.join('\n') ?? ''} ${serializedSelectedPreviewElementsMetadataParts?.join('\n') ?? ''} ${serializedMentionParts?.join(' ') ?? ''}`.trim(),
      );

      if (message.metadata?.compressedHistory) {
        revertedCompactedHistoryStringParts.push(
          `**PREVIOUSLY COMPACTED CHAT HISTORY:**\n${message.metadata.compressedHistory}`,
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
    providerOptions: deepMergeProviderOptions(
      modelWithOptions.providerOptions,
      { anthropic: { thinking: { type: 'disabled' } } },
    ),
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
    'gemini-3.1-flash-lite-preview',
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
        content: `You compress a developer chat history into a dense summary that will replace the original messages in the AI assistant's context window. The assistant that reads your summary will have NO access to the original messages — your output is the sole record.

## Input format
- **User** and **Assistant** turns with full text.
- **[TOOL CALL: ...]** blocks with Input/Output JSON and optional Error text.
- **[SELECTED ELEMENT: ...]**, **[ATTACHED TEXT CLIP: ...]**, **[MENTIONED FILE: ...]** metadata on user messages.
- **[REASONING: ...]** blocks (assistant's chain-of-thought).
- An optional **PREVIOUSLY COMPACTED CHAT HISTORY** section from an earlier compression cycle.

## What to preserve verbatim
- File paths (with line numbers when present), mount prefixes, and directory structures.
- Edit operations: which files were changed, the nature of each change, and any relevant code patterns.
- Error messages, linting diagnostics, and shell command outputs/exit codes.
- User decisions, stated preferences, constraints, and explicit rules.
- Tool call outcomes that affected project state (file writes, deletes, shell commands).
- Unresolved issues or open questions at the end of the conversation.

## What to condense or drop
- Large file-read outputs → summarize as "read <path> (<N> lines, content about <topic>)".
- Reasoning blocks → omit unless they contain a key insight not stated elsewhere.
- Redundant or superseded tool calls (e.g. an edit that was later overwritten).
- Tool call IDs.
- Verbose JSON structure → distill to the relevant fields.

## Previously compacted history
If present, treat it as established ground truth. Incorporate it as-is at the start and append the new conversation information after it. Do not re-summarize or lose details from it.

## Output rules
- Refer to participants as "user" and "assistant".
- Write chronologically. Use markdown headings to separate distinct phases or topics.
- Be more detailed for later parts of the conversation (recency bias).
- Use your full output budget — do not cut short.
- Output ONLY the summary. No titles, preambles, or meta-commentary.`,
      },
      {
        role: 'user',
        content: [{ type: 'text', text: compactConvertedChatHistory }],
      },
    ],
    temperature: 0.1,
    maxOutputTokens: 20000,
  }).then((result) => result.text);

  return compactionResult;
};
