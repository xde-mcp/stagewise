import type { TextClipAttachment } from '@shared/karton-contracts/ui/agent/metadata.js';
import xml from 'xml';
import specialTokens from '../special-tokens.js';

/**
 * Converts a text clip attachment to an LLM-readable context snippet.
 * The text clip is formatted as a stage-attachment XML block so the agent
 * can correlate @{id} references in the user message with the full text content.
 *
 * @param textClip - The text clip attachment to convert
 * @returns Formatted XML-style string that the LLM can parse
 */
export function textClipToContextSnippet(textClip: TextClipAttachment): string {
  return xml({
    [specialTokens.userMsgAttachmentXmlTag]: {
      _attr: {
        type: 'text-clip',
        id: textClip.id,
        label: textClip.label,
        'character-count': textClip.content.length,
      },
      _cdata: textClip.content,
    },
  });
}
