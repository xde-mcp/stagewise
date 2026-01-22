import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@stagewise/stage-ui/components/button';
import {
  PreviewCard,
  PreviewCardTrigger,
  PreviewCardContent,
} from '@stagewise/stage-ui/components/preview-card';
import { cn } from '@stagewise/stage-ui/lib/utils';
import type { DragHandleProps } from './types';
import type { WidgetId } from '@shared/karton-contracts/ui/shared-types';
import { usePanelSettings } from '../hooks';

const MIN_PANEL_HEIGHT = 8 * 4;
const MAX_PANEL_HEIGHT = 2000;

export type PanelContainerProps = {
  id: WidgetId;
  tabUrl: string | undefined;
  ariaLabel: string;
  icon: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  disabled?: boolean;
  dragHandleProps?: DragHandleProps;
  isDragging?: boolean;
  onStateChange?: (state: 'hovered' | 'open' | 'closed') => void;
  triggerClassName?: string;
};

export function PanelContainer(props: PanelContainerProps) {
  // Persisted state via Karton
  const {
    isOpen,
    height: persistedHeight,
    setOpen,
    setHeight,
  } = usePanelSettings(props.id, props.tabUrl);

  // Local state for hover preview (not persisted)
  const [isHovered, setIsHovered] = useState(false);

  // Local state for panel height during session (synced with persisted on change)
  const [panelHeight, setPanelHeight] = useState<number | null>(
    persistedHeight,
  );
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  // Track if we've initialized the height for this panel open session
  const hasInitializedHeightRef = useRef(false);

  // Sync persisted height to local state when it changes (from other tabs or initial load)
  useEffect(() => {
    if (persistedHeight !== null && !isResizing) {
      setPanelHeight(persistedHeight);
    }
  }, [persistedHeight, isResizing]);

  // Reset initialization flag when panel closes
  useEffect(() => {
    if (!isOpen) {
      hasInitializedHeightRef.current = false;
    }
  }, [isOpen]);

  // Derive the combined state for callbacks
  const state: 'hovered' | 'open' | 'closed' = isOpen
    ? 'open'
    : isHovered
      ? 'hovered'
      : 'closed';

  // Measure content height and initialize panel height when panel opens (once per open)
  useEffect(() => {
    if (isOpen && contentRef.current && !hasInitializedHeightRef.current) {
      hasInitializedHeightRef.current = true;

      // Measure natural height without constraint
      const element = contentRef.current;
      const naturalHeight = element.scrollHeight;
      setContentHeight(naturalHeight);

      // Initialize panel height if not set from persistence
      if (panelHeight === null) {
        const maxInitialHeight = window.innerHeight * 0.5;
        const initialHeight = Math.max(
          MIN_PANEL_HEIGHT,
          Math.min(naturalHeight, maxInitialHeight),
        );
        setPanelHeight(initialHeight);
        setHeight(initialHeight);
      }
    }
    // Only run when isOpen changes to true - NOT when panelHeight changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Dynamically update content height when content reflows (e.g., due to width changes)
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;

    const element = contentRef.current;

    const updateContentHeight = () => {
      // Temporarily remove height constraint to measure natural height
      const currentHeight = element.style.height;
      element.style.height = 'auto';
      const naturalHeight = element.scrollHeight;
      element.style.height = currentHeight;
      setContentHeight(naturalHeight);
    };

    const resizeObserver = new ResizeObserver(() => {
      // Use requestAnimationFrame to avoid layout thrashing
      requestAnimationFrame(updateContentHeight);
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isOpen]);

  // Notify parent of state changes
  useEffect(() => {
    props.onStateChange?.(state);
  }, [state, props.onStateChange]);

  // Calculate max height: content height or MAX_PANEL_HEIGHT, whichever is smaller
  const maxHeight =
    contentHeight !== null
      ? Math.min(contentHeight, MAX_PANEL_HEIGHT)
      : MAX_PANEL_HEIGHT;

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startYRef.current = e.clientY;
      startHeightRef.current = panelHeight ?? MIN_PANEL_HEIGHT;

      // Use the contentRef element directly for immediate visual feedback
      const contentElement = contentRef.current;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = moveEvent.clientY - startYRef.current;
        const effectiveMaxHeight =
          contentHeight !== null
            ? Math.min(contentHeight, MAX_PANEL_HEIGHT)
            : MAX_PANEL_HEIGHT;
        const newHeight = Math.max(
          MIN_PANEL_HEIGHT,
          Math.min(effectiveMaxHeight, startHeightRef.current + deltaY),
        );

        // Update DOM directly for smooth resizing (no React re-render during drag)
        if (contentElement) {
          contentElement.style.height = `${newHeight}px`;
        }
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        // Calculate final height
        const deltaY = upEvent.clientY - startYRef.current;
        const effectiveMaxHeight =
          contentHeight !== null
            ? Math.min(contentHeight, MAX_PANEL_HEIGHT)
            : MAX_PANEL_HEIGHT;
        const finalHeight = Math.max(
          MIN_PANEL_HEIGHT,
          Math.min(effectiveMaxHeight, startHeightRef.current + deltaY),
        );

        // Update React state and persist
        setPanelHeight(finalHeight);
        setHeight(finalHeight);
        setIsResizing(false);

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [panelHeight, contentHeight, setHeight],
  );

  const handleButtonClick = useCallback(() => {
    setOpen(!isOpen);
  }, [isOpen, setOpen]);

  const panelContent = (
    <PanelPreviewContent title={props.title ?? props.ariaLabel}>
      {props.children}
    </PanelPreviewContent>
  );

  return (
    <div
      className={cn(
        'relative mt-0 flex shrink-0 flex-row-reverse items-start justify-start gap-0 rounded-lg ring-1 ring-transparent',
        isOpen && 'w-full bg-surface-1 ring-derived',
      )}
    >
      <PreviewCard
        onOpenChange={(open) => {
          // Only update hover state if not already open (pinned)
          if (!isOpen) {
            setIsHovered(open);
          }
        }}
        open={(isOpen || isHovered) && !props.isDragging}
      >
        <PreviewCardTrigger delay={10} closeDelay={10}>
          <Button
            variant="ghost"
            size="icon-md"
            aria-label={props.ariaLabel}
            className={cn(
              'z-10 shrink-0',
              state !== 'closed'
                ? 'text-primary-foreground hover:text-primary-foreground!'
                : 'text-foreground',
              props.isDragging && 'cursor-grabbing',
              props.triggerClassName,
            )}
            disabled={props.disabled}
            onClick={handleButtonClick}
            {...props.dragHandleProps?.attributes}
            {...props.dragHandleProps?.listeners}
          >
            {props.icon}
          </Button>
        </PreviewCardTrigger>

        {!isOpen && (
          <PreviewCardContent
            side="left"
            sideOffset={0}
            align="start"
            className="max-h-[50vh] p-2"
          >
            {panelContent}
          </PreviewCardContent>
        )}
      </PreviewCard>
      {isOpen && (
        <div className="group/resize flex min-w-0 flex-1 flex-col">
          {/* Title row - sits next to the icon */}
          <h3 className="shrink-0 p-2 pb-0 font-medium text-muted-foreground text-sm">
            {props.title ?? props.ariaLabel}
          </h3>
          {/* Resizable content area */}
          <div
            ref={contentRef}
            className="scrollbar-thin overflow-y-auto px-2"
            style={{
              height: panelHeight !== null ? `${panelHeight}px` : 'auto',
              maxHeight: `${maxHeight}px`,
              minHeight: `${MIN_PANEL_HEIGHT}px`,
            }}
          >
            {props.children}
          </div>
          {/* Resize handle - only visible on hover or when resizing */}
          <div
            className={cn(
              'flex h-2 cursor-ns-resize items-center justify-center rounded-b-lg transition-colors',
              isResizing
                ? 'bg-primary/20'
                : 'opacity-0 group-hover/resize:opacity-100 group-hover/resize:hover:bg-muted/50',
            )}
            onMouseDown={handleResizeStart}
          >
            <div
              className={cn(
                'h-0.5 w-8 rounded-full transition-colors',
                isResizing
                  ? 'bg-primary'
                  : 'bg-muted-foreground/30 group-hover/resize:hover:bg-muted-foreground/50',
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PanelPreviewContent({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-stretch gap-1">
      <h3 className="shrink-0 font-regular text-muted-foreground text-xs">
        {title}
      </h3>
      <div className="scrollbar-thin flex-1 overflow-y-auto text-foreground">
        {children}
      </div>
    </div>
  );
}
