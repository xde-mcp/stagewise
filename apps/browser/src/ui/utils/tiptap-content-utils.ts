import posthog from 'posthog-js';
import type { JSONContent } from '@tiptap/core';
import { MarkdownManager } from '@tiptap/markdown';
import { Document } from '@tiptap/extension-document';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { AllAttachmentExtensions } from '@ui/screens/main/sidebar/chat/_components/rich-text';
import type {
  FileAttachment,
  TextClipAttachment,
} from '@shared/karton-contracts/ui/agent/metadata';
import type { SelectedElement } from '@shared/selected-elements';

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
    posthog.captureException(
      error instanceof Error ? error : new Error(String(error)),
      { source: 'renderer', operation: 'markdownToTipTap' },
    );
    // Fallback to simple text content on parse error
    return {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: markdown }] },
      ],
    };
  }
}

/**
 * Injects attachment data from message metadata into TipTap JSON node attrs.
 *
 * markdownToTipTapContent produces attachment nodes with only IDs (the markdown
 * doesn't carry inline data like URLs or text clip content). This function
 * walks the tree and patches each attachment node with the full data from the
 * original message metadata, making the result identical to what the editor
 * produces during fresh composition.
 */
export function enrichTipTapContent(
  content: JSONContent,
  metadata: {
    fileAttachments?: FileAttachment[];
    textClipAttachments?: TextClipAttachment[];
    selectedPreviewElements?: SelectedElement[];
  },
): JSONContent {
  const fileMap = new Map(
    (metadata.fileAttachments ?? []).map((f) => [f.id, f]),
  );
  const clipMap = new Map(
    (metadata.textClipAttachments ?? []).map((c) => [c.id, c]),
  );
  const elementMap = new Map(
    (metadata.selectedPreviewElements ?? []).map((e) => [e.stagewiseId, e]),
  );

  function walk(node: JSONContent): JSONContent {
    const id = node.attrs?.id as string | undefined;

    if (node.type === 'imageAttachment' && id) {
      const file = fileMap.get(id);
      if (file) {
        return {
          ...node,
          attrs: {
            ...node.attrs,
            url: file.url,
            label: file.fileName ?? node.attrs?.label,
            validationError: file.validationError,
          },
        };
      }
    }

    if (node.type === 'fileAttachment' && id) {
      const file = fileMap.get(id);
      if (file) {
        return {
          ...node,
          attrs: {
            ...node.attrs,
            label: file.fileName ?? node.attrs?.label,
            validationError: file.validationError,
          },
        };
      }
    }

    if (node.type === 'textClipAttachment' && id) {
      const clip = clipMap.get(id);
      if (clip) {
        return {
          ...node,
          attrs: {
            ...node.attrs,
            label: clip.label,
            content: clip.content,
          },
        };
      }
    }

    if (node.type === 'elementAttachment' && id) {
      const el = elementMap.get(id);
      if (el) {
        const tagName = (el.nodeType || el.tagName).toLowerCase();
        const domId = el.attributes?.id ? `#${el.attributes.id}` : '';
        return {
          ...node,
          attrs: {
            ...node.attrs,
            label: `${tagName}${domId}`,
          },
        };
      }
    }

    if (node.content) {
      return { ...node, content: node.content.map(walk) };
    }

    return node;
  }

  return walk(content);
}
