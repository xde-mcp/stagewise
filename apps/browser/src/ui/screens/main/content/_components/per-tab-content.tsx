import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@stagewise/stage-ui/lib/utils';
import { useKartonState, useKartonProcedure } from '@ui/hooks/use-karton';
import type { TabState } from '@shared/karton-contracts/ui';
//import { Button } from '@stagewise/stage-ui/components/button';
//import {
//  Tooltip,
//  TooltipContent,
//  TooltipTrigger,
//} from '@stagewise/stage-ui/components/tooltip';
import {
  ResizablePanelGroup,
  ResizablePanel,
  //ResizableHandle,
  type ImperativePanelHandle,
} from '@stagewise/stage-ui/components/resizable';
//import { IconWrenchScrewdriverFillDuo18 } from 'nucleo-ui-fill-duo-18';
import { NavButtons } from './nav-buttons';
import { Omnibox, type OmniboxRef } from './omnibox';
import { ZoomBar } from './control-buttons/zoom-bar';
import { SearchBar, type SearchBarRef } from './control-buttons/search-bar';
import { ResourceRequestsControlButton } from './control-buttons/resource-requests';
import { DownloadsControlButton } from './control-buttons/downloads';
import { DOMContextSelector } from '@ui/components/dom-context-selector/selector-canvas';
import { WebContentsOverlay } from '@ui/components/web-contents-overlay';
import { WebContentsOverlayProvider } from '@ui/contexts';
import { BasicAuthDialog } from './basic-auth-dialog';
//import { DevToolbar, useHasOpenPanel, useToolbarWidth } from './dev-toolbar';
//import { HotkeyComboText } from '@ui/components/hotkey-combo-text';
//import { HotkeyActions } from '@shared/hotkeys';
import { ColorSchemeWidget } from './dev-toolbar/widgets/color-scheme';
import { ChromeDevToolsWidget } from './dev-toolbar/widgets/chrome-devtools';

export interface PerTabContentRef {
  focusOmnibox: () => void;
  focusSearchBar: () => void;
}

interface PerTabContentProps {
  tabId: string;
  isActive: boolean;
}

export const PerTabContent = forwardRef<PerTabContentRef, PerTabContentProps>(
  ({ tabId, isActive }, ref) => {
    const tab = useKartonState((s) => s.browser.tabs[tabId]) as
      | TabState
      | undefined;
    const _toggleDevTools = useKartonProcedure(
      (p) => p.browser.devTools.toggle,
    );
    const omniboxRef = useRef<OmniboxRef>(null);
    const searchBarRef = useRef<SearchBarRef>(null);

    const devAppPreviewContainerRef = useRef<HTMLDivElement>(null);

    //const hasOpenPanel = useHasOpenPanel(tab?.url);
    //const { width: persistedToolbarWidth, setWidth: persistToolbarWidth } =
    //  useToolbarWidth(tab?.url);

    // Local state for optimistic toolbar width updates
    const [_localToolbarSize, setLocalToolbarSize] = useState<number | null>(
      null,
    );
    const pendingWidthRef = useRef<number | null>(null);
    const _toolbarPanelRef = useRef<ImperativePanelHandle>(null);

    /*
    // Sync local state from persisted width on initial load or when persisted changes
    useEffect(() => {
      if (persistedToolbarWidth !== null) {
        setLocalToolbarSize(persistedToolbarWidth);
      }
    }, [persistedToolbarWidth]);

    // Resize toolbar panel when hasOpenPanel becomes true and we have a persisted/local size
    useEffect(() => {
      if (hasOpenPanel && toolbarPanelRef.current) {
        const targetSize = localToolbarSize ?? persistedToolbarWidth ?? 25;
        toolbarPanelRef.current.resize(targetSize);
      }
    }, [hasOpenPanel, localToolbarSize, persistedToolbarWidth]);
    */

    // Dispatch a resize event when the panel layout changes
    // This forces BackgroundWithCutout to recalculate its bounds
    const handlePanelLayoutChange = useCallback((sizes: number[]) => {
      window.dispatchEvent(new Event('resize'));
      // Update local state optimistically during drag
      // sizes[1] is the toolbar panel size (order={2})
      if (sizes.length > 1) {
        const toolbarSize = sizes[1]!;
        setLocalToolbarSize(toolbarSize);
        // Always track the latest size - will be persisted on drag end
        pendingWidthRef.current = toolbarSize;
      }
    }, []);

    // Handle drag end - persist the width when pointer is released
    /*
    const handlePointerUp = useCallback(() => {
      if (pendingWidthRef.current !== null) {
        persistToolbarWidth(pendingWidthRef.current);
      }
    }, [persistToolbarWidth]);
    */

    const isInternalPage = useMemo(() => {
      // Consider a page "internal" if it's a stagewise:// URL or if an error page is displayed
      // (Error pages show the failed URL but are still internal pages)
      const isInternalUrl =
        tab?.url?.startsWith('stagewise://internal/') ?? false;
      const isErrorPageDisplayed = tab?.error?.isErrorPageDisplayed ?? false;
      return isInternalUrl || isErrorPageDisplayed;
    }, [tab?.url, tab?.error?.isErrorPageDisplayed]);

    // Expose methods via ref for parent to call
    useImperativeHandle(
      ref,
      () => ({
        focusOmnibox: () => {
          omniboxRef.current?.focus();
        },
        focusSearchBar: () => {
          searchBarRef.current?.focus();
        },
      }),
      [],
    );

    return (
      <div
        className={cn(
          'absolute inset-0 flex flex-col',
          isActive ? 'z-10' : 'hidden',
        )}
      >
        {/* Control Bar */}
        <div className={cn('flex w-full shrink-0 items-center gap-2 p-2 pb-0')}>
          <NavButtons tabId={tabId} tab={tab} />
          <Omnibox
            ref={omniboxRef}
            tabId={tabId}
            tab={tab}
            isActive={isActive}
          />
          <ZoomBar tabId={tabId} />
          <SearchBar tabId={tabId} ref={searchBarRef} />
          <ResourceRequestsControlButton tabId={tabId} isActive={isActive} />
          <DownloadsControlButton isActive={isActive} />

          {tab && (
            <ColorSchemeWidget
              tab={tab}
              sortableProps={{
                isDragging: false,
                dragHandleProps: {
                  listeners: undefined,
                  attributes: {
                    role: 'button',
                    tabIndex: 0,
                    'aria-disabled': false,
                    'aria-pressed': false,
                    'aria-roledescription': '',
                    'aria-describedby': '',
                  },
                },
              }}
            />
          )}

          {tab && (
            <ChromeDevToolsWidget
              tab={tab}
              sortableProps={{
                isDragging: false,
                dragHandleProps: {
                  listeners: undefined,
                  attributes: {
                    role: 'button',
                    tabIndex: 0,
                    'aria-disabled': false,
                    'aria-pressed': false,
                    'aria-roledescription': '',
                    'aria-describedby': '',
                  },
                },
              }}
            />
          )}

          {/*
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isInternalPage}
                onClick={() => {
                  toggleDevTools(tabId);
                }}
              >
                <IconWrenchScrewdriverFillDuo18
                  className={cn(
                    'size-5',
                    tab?.devTools.open
                      ? 'text-primary-foreground hover:text-derived-lighter-subtle'
                      : '',
                    isInternalPage ? 'opacity-50' : '',
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {tab?.devTools.open ? 'Close' : 'Open'} developer tools (
              <HotkeyComboText action={HotkeyActions.DEV_TOOLS} />)
            </TooltipContent>
          </Tooltip>
          */}
        </div>
        {/* Content area - wrapped with WebContentsOverlayProvider for overlay access */}
        <WebContentsOverlayProvider>
          <ResizablePanelGroup
            direction="horizontal"
            className={cn(
              'overflow-visible! size-full rounded-lg p-2',
              //tab?.devTools.open && 'pr-0',
            )}
            onLayout={handlePanelLayoutChange}
          >
            {/* Web content panel */}
            <ResizablePanel
              order={1}
              defaultSize={100}
              className="overflow-visible!"
            >
              <div className="flex size-full flex-col items-center justify-center overflow-hidden rounded-[3.5px] ring-1 ring-derived-subtle">
                <div
                  ref={devAppPreviewContainerRef}
                  id={`dev-app-preview-container-${tabId}`}
                  className="relative flex size-full flex-col items-center justify-center overflow-hidden rounded-lg"
                >
                  {/* Unified web contents overlay for devtools and DOM selection */}
                  {isActive && !isInternalPage && <WebContentsOverlay />}
                  {/* DOM context selector - uses the unified overlay via hook */}
                  {isActive && !isInternalPage && <DOMContextSelector />}
                  {isActive && tab?.authenticationRequest && (
                    <BasicAuthDialog
                      request={tab.authenticationRequest}
                      container={devAppPreviewContainerRef}
                    />
                  )}
                </div>
              </div>
            </ResizablePanel>

            {/* Dev toolbar */}
            {/*
            {tab?.devTools.open && (
              <>
                {hasOpenPanel && (
                  <ResizableHandle
                    className="ml-1"
                    onPointerUp={handlePointerUp}
                  />
                )}
                <ResizablePanel
                  ref={toolbarPanelRef}
                  order={2}
                  defaultSize={
                    hasOpenPanel
                      ? (localToolbarSize ?? persistedToolbarWidth ?? 25)
                      : 0
                  }
                  minSize={0}
                  maxSize={100}
                  className={cn(
                    'overflow-visible! min-w-fit max-w-fit',
                    hasOpenPanel ? 'min-w-64 max-w-1/2' : '',
                  )}
                >
                  <DevToolbar tab={tab} />
                </ResizablePanel>
              </>
            )}
            */}
          </ResizablePanelGroup>
        </WebContentsOverlayProvider>
      </div>
    );
  },
);

PerTabContent.displayName = 'PerTabContent';
