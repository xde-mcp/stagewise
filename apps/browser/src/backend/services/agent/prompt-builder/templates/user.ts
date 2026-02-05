import type { ChatMessage, SelectedElement } from '@shared/karton-contracts/ui';
import { convertToModelMessages, type UserModelMessage } from 'ai';
import xml from 'xml';
import specialTokens from '../utils/special-tokens';
import {
  relevantCodebaseFilesToContextSnippet,
  selectedElementToContextSnippet,
} from '../utils/metadata-converter/html-elements';
import { textClipToContextSnippet } from '../utils/metadata-converter/text-clips';

export async function getUserMessage(
  userMessage: ChatMessage,
): Promise<UserModelMessage> {
  const p = [...userMessage.parts]; // TODO: Do the wrapping of 'user-msg' here!!
  const parts = p.map((part) => {
    if (part.type === 'text')
      return {
        ...part,
        text: xml({ 'user-msg': { _cdata: part.text } }),
      };
    return part;
  });

  if ((userMessage.metadata?.fileAttachments?.length || 0) > 0) {
    userMessage.metadata?.fileAttachments?.forEach((f) => {
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
    await convertToModelMessages([{ ...userMessage, parts }])
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
    userMessage.metadata?.rejectedEdits &&
    userMessage.metadata.rejectedEdits.length > 0
  ) {
    systemAttachmentTextPart.push(
      `<${specialTokens.userMsgAttachmentXmlTag} type="rejected-edits" value="${userMessage.metadata.rejectedEdits.join(',')}"/>`,
    );
  }

  // Handle text clip attachments - collapsed long text pasted by user
  // These are referenced in user message as @{id} and contain the full text content
  if (
    userMessage.metadata?.textClipAttachments &&
    userMessage.metadata.textClipAttachments.length > 0
  )
    userMessage.metadata.textClipAttachments.forEach((textClip) => {
      systemAttachmentTextPart.push(textClipToContextSnippet(textClip));
    });

  if (
    userMessage.metadata?.selectedPreviewElements &&
    userMessage.metadata.selectedPreviewElements.length > 0
  ) {
    // We add max 5 context elements to the system attachment to avoid overwhelming the model with too much information.
    // TODO: Add this limitation to the UI as well as to not introduce situations where the user expects the LLM to see more.
    userMessage.metadata.selectedPreviewElements
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
        (userMessage.metadata?.selectedPreviewElements ??
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

  return {
    role: 'user',
    content: convertedMessage.content,
  };
}
