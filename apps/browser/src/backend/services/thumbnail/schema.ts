import { sqliteTable, integer, text, blob } from 'drizzle-orm/sqlite-core';
import { metaTable } from '@/utils/migrate-database/types';

export const meta = metaTable;

export const originThumbnails = sqliteTable('origin_thumbnails', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  origin: text('origin').notNull().unique(),
  imageData: blob('image_data', { mode: 'buffer' }).notNull(),
  width: integer('width').default(0).notNull(),
  height: integer('height').default(0).notNull(),
  lastUpdated: integer('last_updated').default(0).notNull(),
  lastAccessed: integer('last_accessed').default(0).notNull(),
});
