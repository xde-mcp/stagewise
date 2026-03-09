import type { Logger } from '../logger';
import { inArray, sql, lt, eq } from 'drizzle-orm';
import * as schema from './schema';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import type { OriginThumbnailResult } from '@shared/karton-contracts/pages-api/types';
import initSql from './schema.sql?raw';
import { migrateDatabase } from '@/utils/migrate-database';
import { registry, schemaVersion } from './migrations';
import { getDbPath } from '@/utils/paths';

/**
 * Service responsible for persisting origin-level page thumbnails.
 * Stores one downscaled JPEG screenshot per origin for home page cards.
 * Thumbnails prefer "root" state: updates only happen when the current
 * URL path is shorter than or equal to the path stored for that origin.
 */
export class ThumbnailService {
  private logger: Logger;
  private dbDriver;
  private db;
  /** In-memory cache of origin -> last stored path to avoid DB reads */
  private pathCache = new Map<string, string>();

  private constructor(logger: Logger) {
    this.logger = logger;
    const dbPath = getDbPath('thumbnails');
    this.dbDriver = createClient({
      url: `file:${dbPath}`,
    });
    this.db = drizzle(this.dbDriver, { schema });
  }

  public static async create(logger: Logger): Promise<ThumbnailService> {
    const instance = new ThumbnailService(logger);
    await instance.initialize();
    logger.debug('[ThumbnailService] Created service');
    return instance;
  }

  private async initialize(): Promise<void> {
    this.logger.debug('[ThumbnailService] Initializing...');
    try {
      await migrateDatabase({
        db: this.db,
        client: this.dbDriver,
        registry,
        initSql,
        schemaVersion,
      });
      this.logger.debug('[ThumbnailService] Initialized');
    } catch (e) {
      this.logger.error('[ThumbnailService] Failed to initialize', {
        error: e,
      });
    }
  }

  public teardown(): void {
    this.dbDriver.close();
    this.logger.debug('[ThumbnailService] Shutdown complete');
  }

  // =================================================================
  //  STORAGE API
  // =================================================================

  /**
   * Check whether a thumbnail update should proceed for the given origin.
   * Returns `allowed: false` when the current path is deeper than the
   * stored one. When allowed, `isShorterPath` indicates the current path
   * is strictly shorter — callers can use this to bypass time throttles
   * so that navigating to a shallower page captures immediately.
   */
  async shouldUpdateThumbnail(
    origin: string,
    currentPath: string,
  ): Promise<{ allowed: boolean; isShorterPath: boolean }> {
    let storedPath = this.pathCache.get(origin);

    if (storedPath === undefined) {
      // Cache miss – read from DB once
      const row = await this.db
        .select({ lastPath: schema.originThumbnails.lastPath })
        .from(schema.originThumbnails)
        .where(eq(schema.originThumbnails.origin, origin))
        .get();

      storedPath = row?.lastPath ?? undefined;
      // Cache the result (empty string means no path stored yet)
      this.pathCache.set(origin, storedPath ?? '');
    }

    // No stored thumbnail yet – always allow the first capture
    if (!storedPath) return { allowed: true, isShorterPath: false };

    const allowed = currentPath.length <= storedPath.length;
    const isShorterPath = currentPath.length < storedPath.length;
    return { allowed, isShorterPath };
  }

  /**
   * Store (upsert) a thumbnail for an origin, recording the URL path.
   */
  async storeThumbnail(
    origin: string,
    urlPath: string,
    buffer: Buffer,
    width: number,
    height: number,
  ): Promise<void> {
    const now = Date.now();
    await this.db
      .insert(schema.originThumbnails)
      .values({
        origin,
        imageData: buffer,
        width,
        height,
        lastUpdated: now,
        lastAccessed: now,
        lastPath: urlPath,
      })
      .onConflictDoUpdate({
        target: schema.originThumbnails.origin,
        set: {
          imageData: buffer,
          width,
          height,
          lastUpdated: now,
          lastAccessed: now,
          lastPath: urlPath,
        },
      });

    // Update the in-memory cache
    this.pathCache.set(origin, urlPath);
  }

  // =================================================================
  //  RETRIEVAL API
  // =================================================================

  /**
   * Get thumbnails for multiple origins.
   * Returns a map of origin -> thumbnail result with base64 image data.
   */
  async getThumbnailsForOrigins(
    origins: string[],
  ): Promise<Map<string, OriginThumbnailResult>> {
    if (origins.length === 0) return new Map();

    const now = Date.now();
    const results = new Map<string, OriginThumbnailResult>();

    const rows = await this.db
      .select()
      .from(schema.originThumbnails)
      .where(inArray(schema.originThumbnails.origin, origins));

    const accessedIds: number[] = [];

    for (const row of rows) {
      if (row.imageData) {
        results.set(row.origin, {
          origin: row.origin,
          imageData: Buffer.from(row.imageData).toString('base64'),
          width: row.width,
          height: row.height,
        });
        accessedIds.push(row.id);
      }
    }

    // Update lastAccessed for retrieved thumbnails
    if (accessedIds.length > 0) {
      await this.db
        .update(schema.originThumbnails)
        .set({ lastAccessed: now })
        .where(inArray(schema.originThumbnails.id, accessedIds));
    }

    return results;
  }

  // =================================================================
  //  MAINTENANCE API
  // =================================================================

  /**
   * Evict thumbnails that haven't been accessed in maxAgeDays.
   */
  async evictStaleThumbnails(maxAgeDays = 30): Promise<number> {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.originThumbnails)
      .where(lt(schema.originThumbnails.lastAccessed, cutoff))
      .get();

    const toDelete = countResult?.count ?? 0;

    if (toDelete > 0) {
      // Collect evicted origins to clear from path cache
      const evicted = await this.db
        .select({ origin: schema.originThumbnails.origin })
        .from(schema.originThumbnails)
        .where(lt(schema.originThumbnails.lastAccessed, cutoff));
      for (const row of evicted) {
        this.pathCache.delete(row.origin);
      }

      await this.db
        .delete(schema.originThumbnails)
        .where(lt(schema.originThumbnails.lastAccessed, cutoff));
      this.logger.debug(
        `[ThumbnailService] Evicted ${toDelete} stale thumbnails`,
      );
    }

    return toDelete;
  }

  /**
   * Clear all thumbnail data.
   */
  async clearAllData(): Promise<number> {
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.originThumbnails)
      .get();
    const count = countResult?.count ?? 0;

    await this.db.delete(schema.originThumbnails);
    this.pathCache.clear();

    return count;
  }

  /**
   * Run VACUUM to reclaim disk space.
   */
  async vacuum(): Promise<void> {
    await this.dbDriver.execute('VACUUM');
  }
}
