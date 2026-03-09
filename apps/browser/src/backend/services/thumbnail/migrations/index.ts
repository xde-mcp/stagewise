import { sql } from 'drizzle-orm';
import type { MigrationScript } from '../../../utils/migrate-database/types';

const registry: MigrationScript[] = [
  {
    version: 2,
    name: 'add-last-path',
    up: async (db) => {
      await db.run(
        sql`ALTER TABLE origin_thumbnails ADD COLUMN last_path TEXT`,
      );
    },
  },
];
const schemaVersion = 2;

export { registry, schemaVersion };
