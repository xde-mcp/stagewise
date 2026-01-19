import { type ReactNode, useMemo } from 'react';
import type { SearchEngine } from '@shared/karton-contracts/ui/shared-types';

import {
  IconMagnifierFill18,
  IconRefreshAnticlockwiseFill18,
} from 'nucleo-ui-fill-18';
import { IconGlobe3Fill18 } from 'nucleo-ui-fill-18';

/**
 * Determines if the input is a URL or search query, and returns the appropriate URL.
 *
 * @param input - User input from the omnibox
 * @param searchEngines - Available search engines
 * @param defaultEngineId - ID of the default search engine
 * @param searchEngineId - Optional: specific search engine ID to use
 * @param searchEngineKeyword - Optional: search engine keyword to use (takes precedence)
 */
export function convertOmniboxInputToUrl(
  input: string,
  searchEngines: SearchEngine[],
  defaultEngineId: number,
  searchEngineId?: number,
  searchEngineKeyword?: string,
): string {
  const trimmed = input.trim();

  const category = categorizeUrlInput(input);
  if (category === 'url') {
    return input;
  }

  if (category === 'url-like') {
    return `https://${input}`;
  }

  // We first get the matching engine
  const engine = (() => {
    if (searchEngineKeyword) {
      const lowerKeyword = searchEngineKeyword.toLowerCase();
      return searchEngines.find(
        (e) => e.keyword.toLowerCase() === lowerKeyword,
      );
    } else if (searchEngineId !== undefined) {
      return searchEngines.find((e) => e.id === searchEngineId);
    } else {
      return searchEngines.find((e) => e.id === defaultEngineId);
    }
  })();

  // Check if we have no valid search engine (force to create an url)
  if (!engine) {
    return `https://${encodeURIComponent(trimmed)}`;
  }

  return engine.url.replace('{searchTerms}', encodeURIComponent(trimmed));
}

export function categorizeUrlInput(
  input: string,
): 'url' | 'url-like' | 'search' {
  // Check if it starts with stagewise:/ - always treat as URL
  if (input.toLowerCase().startsWith('stagewise:/')) {
    return 'url';
  }

  // Check if it's already a valid URL with protocol
  try {
    new URL(input);
    return 'url';
  } catch {
    // Not a valid URL, continue checking
  }

  // Check if it looks like a domain (no spaces, has a dot)
  if (
    !input.includes(' ') &&
    input.split('.').filter((p) => p.length > 0).length > 1
  ) {
    return 'url-like';
  }

  return 'search';
}

export type OmniboxSuggestionGroup = {
  label?: string;
  items: OmniboxSuggestionItem[];
};

// Internally used type for omnibox suggestions. Every suggestion will be rendered differently based on the type.
export type OmniboxSuggestionItem = {
  type:
    | 'reload-same-page'
    | 'page-nav-suggestion'
    | 'search-suggestion'
    | 'past-search'
    | 'past-page';
  value: string; // The actual value of the entry (always an URL) (base-ui default key)
  label?: string; // The value to be displayed in the input (may be different from the value for searches) (base-ui default key)
  suggestionLabel?: string | ReactNode; // The label to be displayed in the suggestion
  suggestionIcon?: ReactNode; // The icon to be displayed in the suggestion
};

export function useOmniboxSuggestions(
  currentUrl: string | undefined,
  input: string,
  searchEngines: SearchEngine[],
  defaultEngineId: number,
  searchEngineId?: number,
  searchEngineKeyword?: string,
): OmniboxSuggestionGroup[] {
  return useMemo(() => {
    if (input.trim() === '') {
      return [];
    }

    const inputType = categorizeUrlInput(input);

    const changed = currentUrl !== input;

    const dummy = true;

    const engine = (() => {
      if (searchEngineKeyword) {
        const lowerKeyword = searchEngineKeyword.toLowerCase();
        return searchEngines.find(
          (e) => e.keyword.toLowerCase() === lowerKeyword,
        );
      } else if (searchEngineId !== undefined) {
        return searchEngines.find((e) => e.id === searchEngineId);
      } else {
        return searchEngines.find((e) => e.id === defaultEngineId);
      }
    })();

    const items: OmniboxSuggestionGroup[] = [
      ...(!changed && currentUrl && currentUrl.length > 0
        ? [
            {
              items: [
                {
                  type: 'reload-same-page' as const,
                  value: input,
                  label: input,
                  suggestionIcon: (
                    <IconRefreshAnticlockwiseFill18 className="size-4 text-muted-foreground" />
                  ),
                  suggestionLabel: <span>Reload current page</span>,
                },
              ],
            },
          ]
        : []),
      ...(changed &&
      (inputType === 'url' || inputType === 'url-like' || !engine)
        ? [
            {
              items: [
                {
                  type: 'page-nav-suggestion' as const,
                  value: getSimplePageNavUrl(input.trim()),
                  label: input.trim(),
                  suggestionLabel: (
                    <span>
                      Open <strong>{input.trim()}</strong>
                    </span>
                  ),
                  suggestionIcon: (
                    <IconGlobe3Fill18 className="size-4 text-muted-foreground" />
                  ),
                },
              ],
            },
          ]
        : []),
      ...(changed && inputType === 'search' && engine
        ? [
            {
              items: [
                {
                  type: 'search-suggestion' as const,
                  value: getSearchUrl(input.trim(), engine),
                  label: input.trim(),
                  suggestionLabel: (
                    <span className="text-muted-foreground">
                      Search for "
                      <strong className="text-foreground">
                        {input.trim()}
                      </strong>
                      " with {engine.shortName}
                    </span>
                  ),
                  suggestionIcon: (
                    <img
                      src={engine.faviconUrl}
                      alt=""
                      className="size-4 text-muted-foreground"
                    />
                  ),
                },
              ],
            },
          ]
        : []),
      ...(dummy && engine
        ? [
            {
              label: 'Recent searches',
              items: [
                {
                  type: 'past-search' as const,
                  value: getSearchUrl('old search term', engine),
                  label: 'old search term',
                  suggestionLabel: <strong>old search term</strong>,
                  suggestionIcon: (
                    <IconMagnifierFill18 className="size-4 text-muted-foreground" />
                  ),
                },
              ],
            },
          ]
        : []),
      ...(dummy
        ? [
            {
              label: 'Recent pages',
              items: [
                {
                  type: 'past-page' as const,
                  value: 'https://www.oldpage.com',
                  label: 'www.oldpage.com',
                  suggestionLabel: <strong>www.oldpage.com</strong>,
                  suggestionIcon: (
                    <IconGlobe3Fill18 className="size-4 text-muted-foreground" />
                  ),
                },
              ],
            },
          ]
        : []),
    ];

    return items;
  }, [
    currentUrl,
    input,
    searchEngines,
    defaultEngineId,
    searchEngineId,
    searchEngineKeyword,
  ]);
}

function getSimplePageNavUrl(input: string): string {
  const category = categorizeUrlInput(input);

  if (category === 'url') {
    return input;
  }

  if (category === 'url-like') {
    if (
      input.startsWith('localhost:') ||
      input.startsWith('127.0.0.1:') ||
      input.startsWith('::1:') ||
      input.startsWith('[::1]:')
    ) {
      return `http://${input}`;
    }
    return `https://${input}`;
  }

  return `https://${encodeURIComponent(input)}`;
}

function getSearchUrl(input: string, searchEngine: SearchEngine): string {
  return searchEngine.url.replace('{searchTerms}', encodeURIComponent(input));
}
