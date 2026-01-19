import {
  type Ref,
  useCallback,
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
} from 'react';
import type { TabState } from '@shared/karton-contracts/ui';
import {
  Autocomplete,
  type AutocompleteRootProps,
} from '@base-ui/react/autocomplete';
import { PageTransition } from '@shared/karton-contracts/pages-api/types';
import { useKartonProcedure, useKartonState } from '@/hooks/use-karton';
import { type OmniboxSuggestionItem, useOmniboxSuggestions } from './utils';
import { Button } from '@stagewise/stage-ui/components/button';
import { cn } from '@stagewise/stage-ui/lib/utils';
import { InternalPageBreadcrumbs } from './internal-page-breadcrumbs';

export interface OmniboxRef {
  focus: () => void;
}

export const Omnibox = ({
  tabId,
  tab,
  ref,
}: {
  tabId: string;
  tab: TabState | undefined;
  ref: Ref<OmniboxRef>;
}) => {
  const displayedTabUrl =
    tab?.url === 'stagewise://internal/home' ? '' : tab?.url;

  const goto = useKartonProcedure((p) => p.browser.goto);
  const defaultEngineId = useKartonState(
    (s) => s.preferences.search.defaultEngineId,
  );
  const searchEngines = useKartonState((s) => s.searchEngines);

  const [isOmniboxOpen, setIsOmniboxOpen] = useState(false);

  const [inputValue, setInputValue] = useState(displayedTabUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  // Expose focus method via ref
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        setIsOmniboxOpen(true);
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 10);
      },
    }),
    [],
  );

  const shouldShowBreadcrumbs = displayedTabUrl.startsWith(
    'stagewise://internal/',
  );

  useEffect(() => {
    if (!isOmniboxOpen) {
      setInputValue(displayedTabUrl);
    }
  }, [displayedTabUrl, tab?.isLoading]);

  const onValueChange = useCallback<
    AutocompleteRootProps<OmniboxSuggestionItem>['onValueChange']
  >((value, details) => {
    if (details.reason !== 'escape-key') {
      setInputValue(value);
    }

    if (details.reason === 'escape-key') {
      inputRef.current?.blur();
    }

    if (!open) {
      // We should clear stale suggestions for the omnibox if it's not shown anyway
      resetSuggestions();
    }
  }, []);

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      // Navigate with TYPED transition to indicate user typed in omnibox
      goto(inputValue, tabId, PageTransition.TYPED);
    },
    [inputValue, tabId],
  );

  const { groups: suggestionGroups, resetSuggestions } = useOmniboxSuggestions(
    displayedTabUrl,
    inputValue,
    searchEngines,
    defaultEngineId,
    undefined,
    undefined,
  );

  const onOpenChange = useCallback((open: boolean) => {
    setIsOmniboxOpen(open);
    if (!open) {
      inputRef.current?.blur();
    }
  }, []);

  const showDefaultBrowserInfo = false; // TODO

  return (
    <form onSubmit={onSubmit} className="flex-1">
      <Autocomplete.Root
        items={suggestionGroups}
        openOnInputClick
        open={isOmniboxOpen}
        onOpenChange={onOpenChange}
        value={inputValue}
        defaultValue={inputValue}
        onValueChange={onValueChange}
        highlightItemOnHover
        submitOnItemClick
        modal
        autoHighlight="always"
        keepHighlight={true}
        mode="inline"
      >
        <div className="flex-1">
          <Autocomplete.Input
            ref={inputRef}
            placeholder="Search or type a URL"
            className={cn(
              'h-8 w-full flex-1 rounded-full pr-5 pl-3 text-muted-foreground text-sm ring-1 ring-transparent transition-all duration-150 ease-out hover:ring-derived-subtle focus:bg-surface-1 focus:text-foreground focus:outline-none focus:ring-derived-strong',
              shouldShowBreadcrumbs && !isOmniboxOpen && 'text-transparent',
            )}
          />
          {shouldShowBreadcrumbs && !isOmniboxOpen && (
            <InternalPageBreadcrumbs url={displayedTabUrl} />
          )}
        </div>
        <Autocomplete.Portal>
          <Autocomplete.Backdrop className="app-no-drag absolute inset-0 size-full bg-black" />
          <Autocomplete.Positioner
            className="outline-none"
            side="bottom"
            sideOffset={6}
          >
            <Autocomplete.Popup
              className="data-ending-style:-translate-y-2 data-starting-style:-translate-y-2 w-[calc(var(--anchor-width)-0.5rem)] max-w-[calc(var(--anchor-width)-0.5rem)] rounded-xl bg-surface-1 p-1 text-foreground shadow-lg ring-1 ring-derived-subtle transition-all duration-150 ease-out data-ending-style:scale-y-95 data-starting-style:scale-y-95 data-ending-style:rounded-t-none data-startinstyle:rounded-t-none data-ending-style:opacity-0 data-starting-style:opacity-0"
              finalFocus={false}
            >
              {suggestionGroups.length === 0 && (
                <Autocomplete.Empty className="p-3.5 text-muted-foreground text-sm empty:m-0 empty:p-0">
                  {inputValue.trim() !== ''
                    ? 'No suggestions found.'
                    : 'Start typing :)'}
                </Autocomplete.Empty>
              )}
              <Autocomplete.List className="divide-y divide-surface-2">
                {suggestionGroups
                  .filter((g) => g.items.length > 0)
                  .map((group, gIdx) => (
                    <Autocomplete.Group
                      key={`${group.label}-${gIdx}`}
                      className="py-2 first:pt-0 last:pb-0"
                    >
                      {group.label && (
                        <Autocomplete.GroupLabel className="mt-0.5 mb-1 pl-2 font-medium text-muted-foreground text-xs">
                          {group.label}
                        </Autocomplete.GroupLabel>
                      )}
                      {group.items.map((item, i) => (
                        <Autocomplete.Item
                          key={`${item.type}-${item.value}-${i}`}
                          className="flex flex-row items-center gap-3 rounded-md px-3 py-2 text-sm data-highlighted:bg-surface-2"
                          value={item.value}
                        >
                          <div className="flex flex-row items-center gap-3">
                            <div className="shrink-0">
                              {item.suggestionIcon}
                            </div>
                            {item.suggestionLabel ?? item.value}
                          </div>
                        </Autocomplete.Item>
                      ))}
                    </Autocomplete.Group>
                  ))}
              </Autocomplete.List>
              {showDefaultBrowserInfo && (
                <div className="mt-2 flex w-full items-center justify-end gap-4 rounded-md px-1 py-1 text-primary-solid text-sm">
                  <span>
                    Always building something new?{' '}
                    <strong className="font-medium">
                      Set stagewise as your default browser!
                    </strong>
                  </span>
                  <Button variant="primary" size="xs">
                    Set as default
                  </Button>
                </div>
              )}
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>
    </form>
  );
};
