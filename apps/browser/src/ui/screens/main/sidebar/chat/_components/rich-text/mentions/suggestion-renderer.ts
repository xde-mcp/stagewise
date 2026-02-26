import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type {
  SuggestionProps,
  SuggestionKeyDownProps,
} from '@tiptap/suggestion';
import { SuggestionPopup } from './suggestion-popup';
import type { ResolvedMentionItem } from './types';

export const mentionSuggestionActive = { current: false };

export function createSuggestionRenderer() {
  let root: Root | null = null;
  let container: HTMLElement | null = null;
  let selectedIndex = 0;
  let currentProps: SuggestionProps<ResolvedMentionItem> | null = null;

  function renderPopup() {
    if (!root || !currentProps) return;

    const items = currentProps.items;
    const clamped = Math.max(0, Math.min(selectedIndex, items.length - 1));

    if (clamped !== selectedIndex) selectedIndex = clamped;

    root.render(
      createElement(SuggestionPopup, {
        items,
        selectedIndex,
        onSelect: (item: ResolvedMentionItem) => currentProps?.command(item),
        clientRect: currentProps.clientRect ?? null,
      }),
    );
  }

  return {
    onStart(props: SuggestionProps<ResolvedMentionItem>) {
      mentionSuggestionActive.current = true;
      currentProps = props;
      selectedIndex = 0;

      container = document.createElement('div');
      container.className = 'mention-suggestion-container';
      document.body.appendChild(container);
      root = createRoot(container);
      renderPopup();
    },

    onUpdate(props: SuggestionProps<ResolvedMentionItem>) {
      currentProps = props;
      selectedIndex = 0;
      renderPopup();
    },

    onKeyDown({ event }: SuggestionKeyDownProps) {
      if (!currentProps) return false;
      const count = currentProps.items.length;
      if (count === 0) return false;

      if (event.key === 'ArrowDown') {
        selectedIndex = (selectedIndex + 1) % count;
        renderPopup();
        return true;
      }

      if (event.key === 'ArrowUp') {
        selectedIndex = (selectedIndex - 1 + count) % count;
        renderPopup();
        return true;
      }

      if (event.key === 'Enter') {
        const item = currentProps.items[selectedIndex];
        if (item) currentProps.command(item);
        return true;
      }

      if (event.key === 'Escape') {
        return true;
      }

      return false;
    },

    onExit() {
      mentionSuggestionActive.current = false;
      root?.unmount();
      container?.remove();
      root = null;
      container = null;
      currentProps = null;
    },
  };
}
