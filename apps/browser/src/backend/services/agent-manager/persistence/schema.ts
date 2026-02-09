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
import superjson from 'superjson';

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

const _sqliteJson = customType<{ data: unknown; driverData: string }>({
  dataType() {
    return 'text';
  },
  toDriver(value) {
    return superjson.stringify(value);
  },
  fromDriver(value) {
    return superjson.parse(value);
  },
});

export const meta = metaTable;

export const agentInstances = sqliteTable(
  'agentInstances',
  {
    id: text('id').primaryKey(),
    parentAgentInstanceId: text('parent_agent_instance_id'),
    type: agentType('type').notNull(),
    instanceConfig: _sqliteJson('instance_config').$type<unknown>(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    lastMessageAt: integer('last_message_at', { mode: 'timestamp' }).notNull(),
    activeModelId: modelId('active_model_id').notNull(),
    title: text('title').notNull(),
    history: _sqliteJson('history').notNull().$type<AgentMessage[]>(),
    lastCompactedMessageId: text('last_compacted_message_id'),
    compactedHistory: _sqliteJson('compacted_history').$type<AgentMessage[]>(),
    queuedMessages: _sqliteJson('queued_messages')
      .notNull()
      .$type<(AgentMessage & { role: 'user' })[]>(),
    inputState: _sqliteJson('input_state').notNull().$type<string>(),
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
