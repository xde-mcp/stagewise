import Mention from '@tiptap/extension-mention';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MentionNodeView } from './mention-node-view';
import { createSuggestionRenderer } from './suggestion-renderer';
import { queryAllProviders } from './providers';
import type { ResolvedMentionItem } from './types';

const MENTION_PROTOCOL = 'mention';

/**
 * Configured Mention extension with:
 * - Custom `providerType` attribute for distinguishing file/tab/future mention types
 * - React NodeView rendering via InlineBadge
 * - Markdown serialization as [](mention:providerType:id)
 * - Suggestion popup wired to pluggable providers
 */
export const MentionExtension = Mention.extend({
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      providerType: {
        default: 'file',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-provider-type'),
        renderHTML: (attributes: Record<string, string>) => ({
          'data-provider-type': attributes.providerType,
        }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(
      MentionNodeView as Parameters<typeof ReactNodeViewRenderer>[0],
    );
  },

  renderText({ node }) {
    return `@${node.attrs.label ?? node.attrs.id}`;
  },

  renderMarkdown(node: any) {
    return `[](${MENTION_PROTOCOL}:${node.attrs.providerType}:${node.attrs.id})`;
  },

  markdownTokenizer: {
    name: 'mention',
    level: 'inline' as const,
    start(src: string) {
      return src.match(/\[\]\(mention:/)?.index ?? -1;
    },
    tokenize(src: string) {
      const match = src.match(/^\[\]\(mention:([^:)]+):([^)]+)\)/);
      if (!match) return undefined;
      return {
        type: 'mention',
        raw: match[0],
        providerType: match[1],
        id: match[2],
      };
    },
  },

  parseMarkdown(token: any) {
    return {
      type: 'mention',
      attrs: {
        id: token.id,
        label: token.id,
        providerType: token.providerType,
      },
    };
  },
}).configure({
  HTMLAttributes: { class: 'mention-node' },
  suggestion: {
    char: '@',
    allowSpaces: false,
    items: async ({ query }: { query: string }) => queryAllProviders(query),
    command: ({ editor, range, props }: any) => {
      const item = props as ResolvedMentionItem;
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: 'mention',
            attrs: {
              id: item.id,
              label: item.label,
              providerType: item.providerType,
            },
          },
          { type: 'text', text: ' ' },
        ])
        .run();
    },
    render: createSuggestionRenderer,
  },
});
