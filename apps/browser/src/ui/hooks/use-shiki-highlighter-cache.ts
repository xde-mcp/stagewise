/**
 * Shiki Highlighter Cache
 *
 * Two-tier cache for Shiki syntax highlighting HTML:
 * 1. In-memory Map for fast O(1) lookups
 * 2. localStorage for persistence across page refreshes
 *
 * Features:
 * - LRU eviction when cache size exceeds limits
 * - Debounced localStorage writes to avoid performance issues
 * - Graceful degradation if localStorage is unavailable
 * - HMR survival via window global
 */

/**
 * Configuration for deferred syntax highlighting and caching.
 * Tuned for smooth scrolling in virtualized lists.
 */
export const HIGHLIGHT_CONFIG = {
  /** Maximum cache entries (LRU eviction when exceeded) */
  MAX_CACHE_SIZE: 200,
  /** Debounce delay for localStorage writes (ms) */
  STORAGE_DEBOUNCE_MS: 1500,
  /** localStorage key for the cache */
  STORAGE_KEY: 'stagewise_highlight_cache',
  /** Cache version for migrations */
  CACHE_VERSION: 1,
} as const;

export type CacheEntry = {
  lightHtml: string;
  darkHtml: string;
  accessTime: number;
};

type StorageData = {
  version: number;
  entries: Record<string, CacheEntry>;
};

/**
 * LRU cache for highlighted HTML with localStorage persistence.
 * Keyed by a hash of (code, language, preClassName, compactDiff).
 */
export class HighlightCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private storageDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isHydrated = false;
  private storageAvailable: boolean | null = null;

  constructor(maxSize: number = HIGHLIGHT_CONFIG.MAX_CACHE_SIZE) {
    this.maxSize = maxSize;
  }

  /**
   * Generates a cache key from highlighting parameters.
   * For long code, uses a substring + length to avoid huge keys.
   */
  private generateKey(
    code: string,
    language: string,
    preClassName?: string,
    compactDiff?: boolean,
  ): string {
    const codeHash =
      code.length > 200
        ? `${code.slice(0, 100)}...${code.slice(-50)}:${code.length}`
        : code;
    return `${language}|${preClassName ?? ''}|${compactDiff ?? false}|${codeHash}`;
  }

  /**
   * Checks if localStorage is available (handles private browsing, quota, etc.)
   */
  private checkStorageAvailable(): boolean {
    if (this.storageAvailable !== null) return this.storageAvailable;

    try {
      const testKey = '__stagewise_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      this.storageAvailable = true;
    } catch {
      this.storageAvailable = false;
    }
    return this.storageAvailable;
  }

  /**
   * Lazily hydrates the in-memory cache from localStorage on first access.
   */
  private hydrateFromStorage(): void {
    if (this.isHydrated) return;
    this.isHydrated = true;

    if (typeof window === 'undefined' || !this.checkStorageAvailable()) return;

    try {
      const raw = localStorage.getItem(HIGHLIGHT_CONFIG.STORAGE_KEY);
      if (!raw) return;

      const data: StorageData = JSON.parse(raw);

      // Version check - clear cache if version mismatch
      if (data.version !== HIGHLIGHT_CONFIG.CACHE_VERSION) {
        localStorage.removeItem(HIGHLIGHT_CONFIG.STORAGE_KEY);
        return;
      }

      // Load entries into memory
      for (const [key, entry] of Object.entries(data.entries))
        this.cache.set(key, entry);

      // Evict if we loaded more than max size
      while (this.cache.size > this.maxSize) this.evictOldest();
    } catch (error) {
      console.warn(
        'HighlightCache: Failed to hydrate from localStorage',
        error,
      );
      // Clear corrupted data
      try {
        localStorage.removeItem(HIGHLIGHT_CONFIG.STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Schedules a debounced write to localStorage.
   */
  private schedulePersistence(): void {
    if (typeof window === 'undefined' || !this.checkStorageAvailable()) return;

    // Clear existing timer
    if (this.storageDebounceTimer !== null)
      clearTimeout(this.storageDebounceTimer);

    // Schedule new write
    this.storageDebounceTimer = setTimeout(() => {
      this.storageDebounceTimer = null;
      this.persistToStorage();
    }, HIGHLIGHT_CONFIG.STORAGE_DEBOUNCE_MS);
  }

  /**
   * Persists the current cache state to localStorage.
   */
  private persistToStorage(): void {
    if (typeof window === 'undefined' || !this.checkStorageAvailable()) return;

    try {
      const data: StorageData = {
        version: HIGHLIGHT_CONFIG.CACHE_VERSION,
        entries: Object.fromEntries(this.cache.entries()),
      };
      localStorage.setItem(HIGHLIGHT_CONFIG.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      // Handle quota exceeded - evict entries and retry
      if (
        error instanceof DOMException &&
        (error.name === 'QuotaExceededError' ||
          error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
      ) {
        console.warn(
          'HighlightCache: localStorage quota exceeded, evicting entries',
        );
        // Evict half the entries
        const entriesToEvict = Math.ceil(this.cache.size / 2);
        for (let i = 0; i < entriesToEvict; i++) this.evictOldest();

        // Retry persistence
        try {
          const data: StorageData = {
            version: HIGHLIGHT_CONFIG.CACHE_VERSION,
            entries: Object.fromEntries(this.cache.entries()),
          };
          localStorage.setItem(
            HIGHLIGHT_CONFIG.STORAGE_KEY,
            JSON.stringify(data),
          );
        } catch {
          console.warn(
            'HighlightCache: Failed to persist after eviction, disabling storage',
          );
          this.storageAvailable = false;
        }
      } else {
        console.warn(
          'HighlightCache: Failed to persist to localStorage',
          error,
        );
      }
    }
  }

  /**
   * Evicts the oldest (least recently accessed) entry from the cache.
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Number.POSITIVE_INFINITY;

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.accessTime < oldestTime) {
        oldestTime = entry.accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) this.cache.delete(oldestKey);
  }

  /**
   * Gets a cached entry, updating its access time for LRU tracking.
   */
  get(
    code: string,
    language: string,
    preClassName?: string,
    compactDiff?: boolean,
  ): CacheEntry | undefined {
    // Lazy hydration on first access
    this.hydrateFromStorage();

    const key = this.generateKey(code, language, preClassName, compactDiff);
    const entry = this.cache.get(key);
    if (entry) entry.accessTime = Date.now();

    return entry;
  }

  /**
   * Sets a cache entry and schedules persistence.
   */
  set(
    code: string,
    language: string,
    preClassName: string | undefined,
    compactDiff: boolean | undefined,
    lightHtml: string,
    darkHtml: string,
  ): void {
    // Ensure hydration before writing (to not lose existing entries)
    this.hydrateFromStorage();

    const key = this.generateKey(code, language, preClassName, compactDiff);

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key))
      this.evictOldest();

    this.cache.set(key, {
      lightHtml,
      darkHtml,
      accessTime: Date.now(),
    });

    // Schedule debounced persistence
    this.schedulePersistence();
  }

  /**
   * Clears all cached entries from memory and storage.
   */
  clear(): void {
    this.cache.clear();
    if (this.storageDebounceTimer !== null) {
      clearTimeout(this.storageDebounceTimer);
      this.storageDebounceTimer = null;
    }

    if (typeof window === 'undefined' || !this.checkStorageAvailable()) return;
    try {
      localStorage.removeItem(HIGHLIGHT_CONFIG.STORAGE_KEY);
    } catch {
      // Ignore
    }
  }

  /**
   * Returns the current number of cached entries.
   */
  get size(): number {
    this.hydrateFromStorage();
    return this.cache.size;
  }
}

// Store on window to survive Hot Module Replacement (HMR) during development
declare global {
  interface Window {
    __stagewise_highlight_cache?: HighlightCache;
  }
}

/**
 * Returns the global HighlightCache singleton instance.
 * The instance survives HMR during development via window global.
 */
export function getHighlightCache(): HighlightCache {
  if (!window.__stagewise_highlight_cache)
    window.__stagewise_highlight_cache = new HighlightCache();

  return window.__stagewise_highlight_cache;
}
