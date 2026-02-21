import type { Logger } from '../logger';
import { inArray, sql, lt } from 'drizzle-orm';
import * as schema from './schema';
import { drizzle } from 'drizzle-orm/libsql';
import type { GlobalDataPathService } from '../global-data-path';
import path from 'node:path';
import { createClient } from '@libsql/client';
import type { OriginThumbnailResult } from '@shared/karton-contracts/pages-api/types';
import initSql from './schema.sql?raw';
import { migrateDatabase } from '@/utils/migrate-database';
import { registry, schemaVersion } from './migrations';

/**
 * Service responsible for persisting origin-level page thumbnails.
 * Stores one downscaled JPEG screenshot per origin for home page cards.
 */
export class ThumbnailService {
  private logger: Logger;
  private dbDriver;
  private db;

  private constructor(logger: Logger, paths: GlobalDataPathService) {
    this.logger = logger;
    const dbPath = path.join(paths.globalDataPath, 'Thumbnails');
    this.dbDriver = createClient({
      url: `file:${dbPath}`,
    });
    this.db = drizzle(this.dbDriver, { schema });
  }

  public static async create(
    logger: Logger,
    globalDataPathService: GlobalDataPathService,
  ): Promise<ThumbnailService> {
    const instance = new ThumbnailService(logger, globalDataPathService);
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
   * Store (upsert) a thumbnail for an origin.
   */
  async storeThumbnail(
    origin: string,
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
      })
      .onConflictDoUpdate({
        target: schema.originThumbnails.origin,
        set: {
          imageData: buffer,
          width,
          height,
          lastUpdated: now,
          lastAccessed: now,
        },
      });
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

    return count;
  }

  /**
   * Run VACUUM to reclaim disk space.
   */
  async vacuum(): Promise<void> {
    await this.dbDriver.execute('VACUUM');
  }
}
