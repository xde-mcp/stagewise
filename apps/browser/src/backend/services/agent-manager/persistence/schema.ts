import {
  sqliteTable,
  integer,
  text,
  index,
  primaryKey,
  customType,
} from 'drizzle-orm/sqlite-core';
import type { AgentMessage } from '@shared/karton-contracts/ui/agent';
import { metaTable } from '@/utils/migrate-database/types';
import type { ModelId } from '@shared/available-models';
import { relations } from 'drizzle-orm';
import type { AgentTypes } from '@shared/karton-contracts/ui/agent';

const _sqliteBoolean = customType<{ data: boolean; driverData: number }>({
  dataType() {
    // what SQLite will store
    return 'integer';
  },
  toDriver(value) {
    // TS boolean -> DB integer
    return value ? 1 : 0;
  },
  fromDriver(value) {
    // DB integer -> TS boolean
    return value === 1;
  },
});

const agentType = customType<{ data: AgentTypes; driverData: string }>({
  dataType() {
    return 'text';
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return value as AgentTypes;
  },
});

const modelId = customType<{ data: ModelId; driverData: string }>({
  dataType() {
    return 'text';
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return value as ModelId;
  },
});

const _sqliteDate = customType<{ data: Date; driverData: number }>({
  dataType() {
    return 'integer';
  },

  toDriver(value) {
    return value.getTime();
  },
  fromDriver(value) {
    return new Date(value);
  },
});

export const meta = metaTable;

export const agentInstances = sqliteTable(
  'agentInstances',
  {
    id: text('id').primaryKey(),
    parentAgentInstanceId: text('parent_agent_instance_id'),
    type: agentType('type').notNull(),
    instanceConfig: text('instance_config', { mode: 'json' }).$type<unknown>(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    lastMessageAt: integer('last_message_at', { mode: 'timestamp' }).notNull(),
    activeModelId: modelId('active_model_id').notNull(),
    title: text('title').notNull(),
    history: text('history', { mode: 'json' })
      .notNull()
      .$type<AgentMessage[]>(),
    lastCompactedMessageId: text('last_compacted_message_id'),
    compactedHistory: text('compacted_history', { mode: 'json' }).$type<
      AgentMessage[]
    >(),
    queuedMessages: text('queued_messages', { mode: 'json' })
      .notNull()
      .$type<(AgentMessage & { role: 'user' })[]>(),
    inputState: text('input_state', { mode: 'json' }).notNull().$type<string>(),
    usedTokens: integer('used_tokens').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('agents_created_at_index').on(table.createdAt),
    index('agents_last_message_at_index').on(table.lastMessageAt),
  ],
);

const _agentInstanceRelations = relations(agentInstances, ({ one, many }) => ({
  parentAgentInstance: one(agentInstances, {
    fields: [agentInstances.parentAgentInstanceId],
    references: [agentInstances.id],
  }),
  childAgentInstances: many(agentInstances, {
    relationName: 'childAgentInstances',
  }),
}));

export type NewStoredAgentInstance = typeof agentInstances.$inferInsert;
export type StoredAgentInstance = typeof agentInstances.$inferSelect;
