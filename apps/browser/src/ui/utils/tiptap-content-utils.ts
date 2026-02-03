import type { JSONContent } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { AllAttachmentExtensions } from '@ui/screens/main/sidebar/chat/_components/rich-text';

/**
 * Singleton MarkdownManager instance for parsing markdown with attachment support.
 * Lazily initialized on first use.
 */
let markdownManager: InstanceType<typeof MarkdownManager> | null = null;

function getMarkdownManager(): InstanceType<typeof MarkdownManager> {
  if (!markdownManager) {
    markdownManager = new MarkdownManager({
      extensions: [Document, Paragraph, Text, ...AllAttachmentExtensions],
    });
  }
  return markdownManager;
}

/**
 * Converts markdown text (with attachment links) to TipTap JSON content.
 * Uses TipTap's MarkdownManager with our custom attachment extensions for proper
 * markdown parsing with custom tokenizers for attachment protocols.
 *
 * Attachment data (URLs, content) is NOT embedded in the TipTap content.
 * Instead, attachment view components look up this data from context using
 * the MessageAttachmentsProvider.
 *
 * @param markdown - The markdown text to convert
 * @returns TipTap JSON content with attachment nodes (IDs only, no inline data)
 */
export function markdownToTipTapContent(markdown: string): JSONContent {
  // Use TipTap's MarkdownManager to parse markdown with our custom attachment extensions
  const manager = getMarkdownManager();

  try {
    return manager.parse(markdown);
  } catch (error) {
    console.warn('[markdownToTipTapContent] Parse error:', error);
    // Fallback to simple text content on parse error
    return {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: markdown }] },
      ],
    };
  }
}
