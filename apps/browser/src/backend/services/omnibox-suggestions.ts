import type { Logger } from './logger';
import type { KartonService } from './karton';
import type { HistoryService } from './history';
import type { WebDataService } from './webdata';
import type { FaviconService } from './favicon';
import type { OmniboxSuggestions } from '@shared/karton-contracts/ui';
import { DisposableService } from './disposable';

/**
 * Service responsible for providing omnibox autocomplete suggestions.
 * Has access to both HistoryService (for browsing history) and WebDataService (for search terms).
 */
export class OmniboxSuggestionsService extends DisposableService {
  private readonly logger: Logger;
  private readonly uiKarton: KartonService;
  private readonly historyService: HistoryService;
  private readonly webDataService: WebDataService;
  private readonly faviconService: FaviconService;

  private constructor(
    logger: Logger,
    uiKarton: KartonService,
    historyService: HistoryService,
    webDataService: WebDataService,
    faviconService: FaviconService,
  ) {
    super();
    this.logger = logger;
    this.uiKarton = uiKarton;
    this.historyService = historyService;
    this.webDataService = webDataService;
    this.faviconService = faviconService;
  }

  private async initialize(): Promise<void> {
    this.logger.debug('[OmniboxSuggestionsService] Initializing...');

    // Register the getOmniboxSuggestions procedure handler
    this.uiKarton.registerServerProcedureHandler(
      'getOmniboxSuggestions',
      async (
        _callingClientId: string,
        input: string,
      ): Promise<OmniboxSuggestions> => {
        return this.getSuggestions(input);
      },
    );

    this.logger.debug('[OmniboxSuggestionsService] Initialized');
  }

  public static async create(
    logger: Logger,
    uiKarton: KartonService,
    historyService: HistoryService,
    webDataService: WebDataService,
    faviconService: FaviconService,
  ): Promise<OmniboxSuggestionsService> {
    const instance = new OmniboxSuggestionsService(
      logger,
      uiKarton,
      historyService,
      webDataService,
      faviconService,
    );
    await instance.initialize();
    return instance;
  }

  protected onTeardown(): void {
    this.uiKarton.removeServerProcedureHandler('getOmniboxSuggestions');
    this.logger.debug('[OmniboxSuggestionsService] Teardown complete');
  }

  /**
   * Get omnibox suggestions based on the input string.
   * Queries both history entries and previous search terms.
   * When input is empty, returns most visited pages and frequent searches as defaults.
   *
   * @param input - The user's input in the omnibox
   * @returns Suggestions including matching history entries and search terms
   */
  public async getSuggestions(input: string): Promise<OmniboxSuggestions> {
    const trimmed = input.trim();

    // When input is empty, return default suggestions
    if (!trimmed) {
      const defaults = await this.getDefaultSuggestions();
      return defaults;
    }

    // Run queries in parallel for performance
    const [historyResults, searchTermResults] = await Promise.all([
      this.historyService.queryHistoryForOmnibox({
        text: trimmed,
        limit: 4,
        maxPerHost: 2,
      }),
      this.historyService.querySearchTermsForOmnibox(trimmed, 3),
    ]);

    // Deduplicate history entries: keep shortest URL when multiple URLs share a common prefix
    const sortedByLength = [...historyResults].sort(
      (a, b) => a.url.length - b.url.length,
    );
    const keptUrls: string[] = [];
    const deduplicatedHistory = sortedByLength.filter((h) => {
      // Check if any already-kept URL is a prefix of this URL
      const dominated = keptUrls.some((kept) => h.url.startsWith(kept));
      if (dominated) {
        return false;
      }
      keptUrls.push(h.url);
      return true;
    });

    // Get favicons for history URLs
    const faviconMap = await this.faviconService.getFaviconsForUrls(
      deduplicatedHistory.map((h) => h.url),
    );

    // Get keyword hostnames for search terms
    const keywords = await this.webDataService.getAllKeywords();
    const keywordMap = new Map(keywords.map((k) => [k.id, k.keyword]));

    // Deduplicate search terms by normalized term (case-insensitive)
    const seenTerms = new Set<string>();
    const deduplicatedSearchTerms = searchTermResults.filter((s) => {
      const normalized = s.term.toLowerCase();
      if (seenTerms.has(normalized)) {
        return false;
      }
      seenTerms.add(normalized);
      return true;
    });

    return {
      historyEntries: deduplicatedHistory.map((h) => ({
        url: h.url,
        title: h.title,
        visitCount: h.visitCount,
        lastVisitTime: h.lastVisitTime,
        faviconUrl: faviconMap.get(h.url) ?? null,
      })),
      searchTerms: deduplicatedSearchTerms.map((s) => ({
        term: s.term,
        keyword: keywordMap.get(s.keywordId),
      })),
    };
  }

  /**
   * Get default suggestions when omnibox input is empty.
   * Returns most visited pages (within last 500 navigations, max 2 per host,
   * sorted by visit count then URL length) and frequent search terms.
   */
  private async getDefaultSuggestions(): Promise<OmniboxSuggestions> {
    // Run queries in parallel for performance
    const [mostVisitedResults, frequentSearchResults] = await Promise.all([
      this.historyService.getMostVisitedPagesForOmnibox({
        navigationLimit: 500,
        resultLimit: 4,
        maxPerHost: 2,
      }),
      this.historyService.getFrequentSearchTermsForOmnibox({
        dayWindow: 7,
        minOccurrences: 2,
        limit: 3,
      }),
    ]);

    // Get favicons for history URLs
    const faviconMap = await this.faviconService.getFaviconsForUrls(
      mostVisitedResults.map((h) => h.url),
    );

    // Get keyword hostnames for search terms
    const keywords = await this.webDataService.getAllKeywords();
    const keywordMap = new Map(keywords.map((k) => [k.id, k.keyword]));

    return {
      historyEntries: mostVisitedResults.map((h) => ({
        url: h.url,
        title: h.title,
        visitCount: h.visitCount,
        lastVisitTime: h.lastVisitTime,
        faviconUrl: faviconMap.get(h.url) ?? null,
      })),
      searchTerms: frequentSearchResults.map((s) => ({
        term: s.term,
        keyword: keywordMap.get(s.keywordId),
      })),
    };
  }
}
