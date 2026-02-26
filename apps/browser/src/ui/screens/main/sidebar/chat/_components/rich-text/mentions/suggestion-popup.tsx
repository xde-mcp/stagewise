import { forwardRef, useEffect, useRef } from 'react';
import { cn } from '@/utils';
import type { ResolvedMentionItem } from './types';
import { MentionIcon } from './mention-icon';

interface SuggestionPopupProps {
  items: ResolvedMentionItem[];
  selectedIndex: number;
  onSelect: (item: ResolvedMentionItem) => void;
  clientRect: (() => DOMRect | null) | null;
}

function SuggestionItem({
  item,
  isSelected,
  onSelect,
  onRef,
}: {
  item: ResolvedMentionItem;
  isSelected: boolean;
  onSelect: () => void;
  onRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={onRef}
      type="button"
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
        isSelected
          ? 'bg-hover-derived text-foreground'
          : 'text-foreground hover:bg-hover-derived/50',
      )}
      onClick={onSelect}
      onMouseDown={(e) => e.preventDefault()}
    >
      <MentionIcon
        providerType={item.providerType}
        id={item.id}
        className="size-4 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.description && (
        <span className="shrink-0 truncate text-muted-foreground text-xs">
          {item.description}
        </span>
      )}
    </button>
  );
}

export function SuggestionPopup({
  items,
  selectedIndex,
  onSelect,
  clientRect,
}: SuggestionPopupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement | null>>(new Map());

  useEffect(() => {
    const el = itemRefs.current.get(selectedIndex);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (items.length === 0) {
    return (
      <PopupContainer clientRect={clientRect} ref={containerRef}>
        <div className="px-3 py-2 text-muted-foreground text-sm">
          No results
        </div>
      </PopupContainer>
    );
  }

  return (
    <PopupContainer clientRect={clientRect} ref={containerRef}>
      {items.map((item, idx) => (
        <SuggestionItem
          key={`${item.providerType}:${item.id}`}
          item={item}
          isSelected={idx === selectedIndex}
          onSelect={() => onSelect(item)}
          onRef={(el) => {
            itemRefs.current.set(idx, el);
          }}
        />
      ))}
    </PopupContainer>
  );
}

const PopupContainer = forwardRef<
  HTMLDivElement,
  {
    clientRect: (() => DOMRect | null) | null;
    children: React.ReactNode;
  }
>(function PopupContainer({ clientRect, children }, ref) {
  const rect = clientRect?.();
  if (!rect) return null;

  const top = rect.bottom + 4;
  const left = rect.left;

  return (
    <div
      ref={ref}
      className="fixed z-50 max-h-52 w-64 overflow-y-auto rounded-md border border-derived bg-surface-1 p-1 shadow-lg"
      style={{ top, left }}
    >
      {children}
    </div>
  );
});
