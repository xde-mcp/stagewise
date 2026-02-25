import { sql } from 'drizzle-orm';
import type { MigrationScript } from '@/utils/migrate-database/types';

const registry: MigrationScript[] = [
  {
    version: 2,
    name: 'add-mounted-workspaces',
    up: async (db) => {
      await db.run(
        sql`ALTER TABLE agentInstances ADD COLUMN mounted_workspaces TEXT`,
      );
    },
  },
];
const schemaVersion = 2;

export { registry, schemaVersion };
