import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import { cn } from '@/utils';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import type { TabState } from '@shared/karton-contracts/ui';
import { inferMimeType } from '@shared/mime-utils';
import {
  getFilePreviewForFile,
  type FilePreviewProps,
} from '@ui/components/file-preview';
import type {
  ResolvedMentionItem,
  TabMentionItem,
  FileMentionItem,
} from './types';
import { MentionIcon } from './mention-icon';

type SidePanelContent =
  | {
      type: 'tab';
      key: string;
      screenshot: string;
      title?: string;
      url?: string;
    }
  | {
      type: 'file';
      key: string;
      src: string;
      fileName: string;
      relativePath: string;
      mediaType: string;
      Preview: FC<FilePreviewProps>;
    };

function deriveSidePanel(
  item: ResolvedMentionItem | undefined,
  tabs: Record<string, TabState>,
): SidePanelContent | null {
  if (!item) return null;

  if (item.providerType === 'tab') {
    const meta = (item as TabMentionItem).meta;
    const tabState = tabs[meta.tabId];
    const screenshot = tabState?.screenshot;
    if (!screenshot) return null;
    return {
      type: 'tab',
      key: `tab:${meta.tabId}`,
      screenshot,
      title: tabState.title,
      url: tabState.url,
    };
  }

  if (item.providerType === 'file') {
    const meta = (item as FileMentionItem).meta;
    if (meta.isDirectory) return null;

    const entry = getFilePreviewForFile(meta.fileName);
    const mime = inferMimeType(meta.fileName);

    if (!entry.variants.expanded || entry.id === 'video') return null;

    const src = `sw-file://${meta.mountPrefix}/${encodeURIComponent(meta.relativePath)}`;
    return {
      type: 'file',
      key: `file:${meta.mountedPath}`,
      src,
      fileName: meta.fileName,
      relativePath: meta.relativePath,
      mediaType: mime,
      Preview: entry.variants.compact,
    };
  }

  return null;
}

interface SuggestionPopupProps {
  items: ResolvedMentionItem[];
  selectedIndex: number;
  onSelect: (item: ResolvedMentionItem) => void;
  clientRect: (() => DOMRect | null) | null;
  tabs: Record<string, TabState>;
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
        'flex w-full cursor-default select-none items-center gap-2 rounded-md px-2 py-1 text-left text-xs outline-none transition-colors duration-150 ease-out',
        isSelected
          ? 'bg-surface-1 text-foreground'
          : 'text-foreground hover:bg-surface-1',
      )}
      onClick={onSelect}
      onMouseDown={(e) => e.preventDefault()}
    >
      <MentionIcon
        providerType={item.providerType}
        id={item.id}
        className="size-3 shrink-0 text-muted-foreground"
      />
      <span className="min-w-0 shrink-0">{item.label}</span>
      {item.description && (
        <span
          className="min-w-0 truncate text-subtle-foreground text-xs"
          dir={item.descriptionTruncation === 'start' ? 'rtl' : undefined}
        >
          {item.descriptionTruncation === 'start' ? (
            <span dir="ltr">{item.description}</span>
          ) : (
            item.description
          )}
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
  tabs,
}: SuggestionPopupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement | null>>(new Map());
  const sidePanelRef = useRef<HTMLDivElement>(null);
  const [sidePanelOffset, setSidePanelOffset] = useState(0);

  useEffect(() => {
    const el = itemRefs.current.get(selectedIndex);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const selectedItem = items[selectedIndex] as ResolvedMentionItem | undefined;
  const sidePanel = useMemo(
    () => deriveSidePanel(selectedItem, tabs),
    [selectedItem, tabs],
  );

  useLayoutEffect(() => {
    const itemEl = itemRefs.current.get(selectedIndex);
    const container = containerRef.current;
    const panel = sidePanelRef.current;
    if (!itemEl || !container || !panel) return;

    const containerRect = container.getBoundingClientRect();
    const itemRect = itemEl.getBoundingClientRect();
    const centerY = itemRect.top + itemRect.height / 2 - containerRect.top;

    const panelHeight = panel.offsetHeight;
    const containerHeight = container.offsetHeight;

    let offset = centerY - panelHeight / 2;
    offset = Math.max(0, offset);
    offset = Math.min(offset, containerHeight - panelHeight);

    setSidePanelOffset(offset);
  }, [selectedIndex, sidePanel]);

  if (items.length === 0) {
    return (
      <PopupContainer clientRect={clientRect} ref={containerRef}>
        <div className="px-2 py-1 text-muted-foreground text-xs">
          No results
        </div>
      </PopupContainer>
    );
  }

  return (
    <PopupContainer
      clientRect={clientRect}
      ref={containerRef}
      sidePanel={
        sidePanel ? (
          <PreviewSidePanel ref={sidePanelRef} offset={sidePanelOffset}>
            {sidePanel.type === 'tab' ? (
              <TabPreviewContent
                screenshot={sidePanel.screenshot}
                title={sidePanel.title}
                url={sidePanel.url}
              />
            ) : (
              <FilePreviewContent
                src={sidePanel.src}
                fileName={sidePanel.fileName}
                relativePath={sidePanel.relativePath}
                mediaType={sidePanel.mediaType}
                Preview={sidePanel.Preview}
              />
            )}
          </PreviewSidePanel>
        ) : null
      }
    >
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

const MAX_POPUP_HEIGHT = 208; // max-h-52

const PopupContainer = forwardRef<
  HTMLDivElement,
  {
    clientRect: (() => DOMRect | null) | null;
    children: React.ReactNode;
    sidePanel?: React.ReactNode;
  }
>(function PopupContainer({ clientRect, children, sidePanel }, ref) {
  const rect = clientRect?.();
  if (!rect) return null;

  const gap = 4;
  const spaceAbove = rect.top;
  const placeAbove = spaceAbove >= MAX_POPUP_HEIGHT + gap;

  const style: React.CSSProperties = placeAbove
    ? { bottom: window.innerHeight - rect.top + gap, left: rect.left }
    : { top: rect.bottom + gap, left: rect.left };

  return (
    <div
      ref={ref}
      className="fixed z-50 flex flex-row items-start gap-1"
      style={style}
    >
      <div className="w-64 rounded-lg border border-derived bg-background p-1 shadow-lg">
        <OverlayScrollbar className="max-h-52" defer={false}>
          {children}
        </OverlayScrollbar>
      </div>
      {sidePanel}
    </div>
  );
});

const PreviewSidePanel = forwardRef<
  HTMLDivElement,
  { offset: number; children: React.ReactNode }
>(function PreviewSidePanel({ offset, children }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'absolute left-full ml-1 flex w-56 flex-col gap-2 rounded-lg border border-derived bg-background p-2.5 text-foreground text-xs shadow-lg transition-[top] duration-100 ease-out',
        'fade-in-0 slide-in-from-left-1 animate-in duration-150',
      )}
      style={{ top: offset }}
    >
      {children}
    </div>
  );
});

function TabPreviewContent({
  screenshot,
  title,
  url,
}: {
  screenshot: string;
  title?: string;
  url?: string;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
  }, [screenshot]);

  return (
    <>
      <img
        src={screenshot}
        className="hidden"
        alt=""
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageLoaded(false)}
      />
      {imageLoaded && (
        <div className="flex min-h-20 w-full items-center justify-center overflow-hidden rounded-sm bg-background ring-1 ring-border-subtle">
          <img
            src={screenshot}
            className="max-h-32 max-w-full object-contain"
            alt="Tab preview"
          />
        </div>
      )}
      {title && (
        <span className="truncate font-medium text-foreground text-xs">
          {title}
        </span>
      )}
      {url && (
        <span className="truncate text-[10px] text-subtle-foreground" dir="rtl">
          <span dir="ltr">{url}</span>
        </span>
      )}
    </>
  );
}

function FilePreviewContent({
  src,
  fileName,
  relativePath,
  mediaType,
  Preview,
}: {
  src: string;
  fileName: string;
  relativePath: string;
  mediaType: string;
  Preview: FC<FilePreviewProps>;
}) {
  return (
    <>
      <Preview
        src={src}
        fileName={fileName}
        mediaType={mediaType}
        className="max-h-32"
      />
      <span className="truncate font-medium text-foreground text-xs">
        {fileName}
      </span>
      <span className="truncate text-[10px] text-subtle-foreground" dir="rtl">
        <span dir="ltr">{relativePath}</span>
      </span>
    </>
  );
}
