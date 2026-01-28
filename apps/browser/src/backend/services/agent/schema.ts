import {
  sqliteTable,
  integer,
  text,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
import { bigintTimestamp } from '../chrome-db-utils';
import type { ChatMessage } from '@shared/karton-contracts/ui';
import { metaTable } from '../../utils/migrate-database/types';
import type { ModelId } from '@shared/available-models';

export const meta = metaTable;

export const chats = sqliteTable(
  'chats',
  {
    id: text('id').primaryKey(),
    title: text('title')
      .notNull()
      .default(`New Chat - ${new Date().toISOString()}`),
    lastUsedModelId: text('last_used_model_id').notNull().$type<ModelId>(),
    createdAt: bigintTimestamp('created_at').notNull(),
    updatedAt: bigintTimestamp('updated_at').notNull(),
    draftInputContent: text('draft_input_content'), // nullable TipTap JSON
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('chats_created_at_index').on(table.createdAt),
    index('chats_updated_at_index').on(table.updatedAt),
  ],
);

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    chatId: text('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    messageIndex: integer('message_index').notNull(),
    // The actual UIMessage
    content: text('content', { mode: 'json' }).notNull().$type<ChatMessage>(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('messages_chat_id_index').on(table.chatId),
    index('messages_chat_order_index').on(table.chatId, table.messageIndex),
  ],
);

export type NewChat = typeof chats.$inferInsert;
export type Chat = typeof chats.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Message = typeof messages.$inferSelect;
