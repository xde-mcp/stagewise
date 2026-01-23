import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
} from 'react';
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

/**
 * Context for widgets to control their panel state.
 */
interface PanelControlContextValue {
  /** Open the panel (switch from hover to pinned state) */
  openPanel: () => void;
  /** Whether the panel is currently open (pinned) */
  isOpen: boolean;
}

const PanelControlContext = createContext<PanelControlContextValue | null>(
  null,
);

/**
 * Hook for widgets to control their panel state.
 * Call `openPanel()` to switch from hover preview to fully opened state.
 */
export function usePanelControl(): PanelControlContextValue {
  const context = useContext(PanelControlContext);
  if (!context) {
    // Return a no-op if not in a panel context (e.g., when panel is already open)
    return { openPanel: () => {}, isOpen: true };
  }
  return context;
}

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
  const { isOpen, setOpen } = usePanelSettings(props.id, props.tabUrl);

  // Local state for hover preview (not persisted)
  const [isHovered, setIsHovered] = useState(false);

  // State for portal outlet containers - using state instead of refs
  // so React re-renders when outlets mount/unmount
  const [hoverOutlet, setHoverOutlet] = useState<HTMLDivElement | null>(null);
  const [openOutlet, setOpenOutlet] = useState<HTMLDivElement | null>(null);

  // Ref for the content wrapper - this div gets moved between outlets
  const contentRef = useRef<HTMLDivElement>(null);

  // Move the content wrapper to the appropriate outlet when it changes
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    // Prefer hover outlet when available, fall back to open outlet
    const targetOutlet = hoverOutlet ?? openOutlet;
    if (!targetOutlet) return;

    // Only move if not already in the target
    if (content.parentElement !== targetOutlet) {
      targetOutlet.appendChild(content);
    }
  }, [hoverOutlet, openOutlet]);

  // Derive the combined state for callbacks
  const state: 'hovered' | 'open' | 'closed' = isOpen
    ? 'open'
    : isHovered
      ? 'hovered'
      : 'closed';

  // Notify parent of state changes
  useEffect(() => {
    props.onStateChange?.(state);
  }, [state, props.onStateChange]);

  const handleButtonClick = useCallback(() => {
    setOpen(!isOpen);
  }, [isOpen, setOpen]);

  // Handle hover state changes from PreviewCard
  const handleHoverChange = useCallback(
    (open: boolean) => {
      // Only update hover state if not already open (pinned)
      if (isOpen) return;
      setIsHovered(open);
    },
    [isOpen],
  );

  // Context value for widgets to control panel state
  const panelControlValue = useMemo<PanelControlContextValue>(
    () => ({
      openPanel: () => setOpen(true),
      isOpen,
    }),
    [setOpen, isOpen],
  );

  return (
    <div
      className={cn(
        'relative mt-0 flex shrink-0 flex-col items-stretch justify-start gap-0 rounded-lg ring-1 ring-transparent',
        isOpen && 'w-full bg-surface-1 ring-derived',
      )}
    >
      <div className="flex flex-row-reverse items-start justify-between">
        <PreviewCard
          onOpenChange={handleHoverChange}
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
              className="max-h-[50vh] min-w-56 p-2"
            >
              <PanelPreviewContent title={props.title ?? props.ariaLabel}>
                {/* Portal outlet for hover state */}
                <div ref={setHoverOutlet} />
              </PanelPreviewContent>
            </PreviewCardContent>
          )}
        </PreviewCard>
        {isOpen && (
          <h3 className="flex-1 p-2 pt-2.5 pb-2 font-medium text-muted-foreground text-sm">
            {props.title ?? props.ariaLabel}
          </h3>
        )}
      </div>
      <div className={cn('flex min-w-0 flex-1 flex-col', !isOpen && 'hidden')}>
        {/* Content area */}
        <div className="scrollbar-thin max-h-[50vh] overflow-y-auto px-2 pb-2">
          {/* Portal outlet for open state */}
          <div ref={setOpenOutlet} />
        </div>
      </div>

      {/* Content wrapper - moved between outlets via DOM manipulation */}
      <div ref={contentRef} className="contents">
        <PanelControlContext.Provider value={panelControlValue}>
          {props.children}
        </PanelControlContext.Provider>
      </div>
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
