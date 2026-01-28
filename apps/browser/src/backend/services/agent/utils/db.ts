import { eq, desc, sql, asc, and, gte } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../schema';
import type { NewChat, NewMessage, Message } from '../schema';
import type { ChatMessage } from '@shared/karton-contracts/ui';
import { fromWebKitTimestamp, toWebKitTimestamp } from '../../chrome-db-utils';
import type { ModelId } from '@shared/available-models';

export type ChatSummary = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

type AgentDb = LibSQLDatabase<typeof schema>;

/**
 * Insert a new chat into the database.
 */
export async function insertChat(db: AgentDb, chat: NewChat): Promise<void> {
  await db.insert(schema.chats).values(chat);
}

/**
 * Update the title of an existing chat.
 */
export async function updateChatTitle(
  db: AgentDb,
  chatId: string,
  title: string,
): Promise<void> {
  await db
    .update(schema.chats)
    .set({ title })
    .where(eq(schema.chats.id, chatId));
}

/**
 * Update the updatedAt timestamp of a chat to the current time.
 */
export async function updateChatTimestamp(
  db: AgentDb,
  chatId: string,
): Promise<void> {
  await db
    .update(schema.chats)
    .set({ updatedAt: toWebKitTimestamp(new Date()) })
    .where(eq(schema.chats.id, chatId));
}

/**
 * Update the lastUsedModelId of a chat.
 */
export async function updateChatModelId(
  db: AgentDb,
  chatId: string,
  modelId: ModelId,
): Promise<void> {
  await db
    .update(schema.chats)
    .set({ lastUsedModelId: modelId })
    .where(eq(schema.chats.id, chatId));
}

/**
 * Get the lastUsedModelId from the most recently updated chat.
 * Returns null if no chats exist.
 */
export async function getMostRecentChatModelId(
  db: AgentDb,
): Promise<string | null> {
  const row = await db
    .select({ lastUsedModelId: schema.chats.lastUsedModelId })
    .from(schema.chats)
    .orderBy(desc(schema.chats.updatedAt))
    .limit(1)
    .get();
  return row?.lastUsedModelId ?? null;
}

/**
 * Get the lastUsedModelId for a specific chat.
 */
export async function getChatModelId(
  db: AgentDb,
  chatId: string,
): Promise<string | null> {
  const row = await db
    .select({ lastUsedModelId: schema.chats.lastUsedModelId })
    .from(schema.chats)
    .where(eq(schema.chats.id, chatId))
    .get();
  return row?.lastUsedModelId ?? null;
}

/**
 * Get chat details (modelId and draftInputContent) for a specific chat.
 */
export async function getChatDetails(
  db: AgentDb,
  chatId: string,
): Promise<{
  lastUsedModelId: string;
  draftInputContent: string | null;
} | null> {
  const row = await db
    .select({
      lastUsedModelId: schema.chats.lastUsedModelId,
      draftInputContent: schema.chats.draftInputContent,
    })
    .from(schema.chats)
    .where(eq(schema.chats.id, chatId))
    .get();
  return row ?? null;
}

/**
 * Update the draft input content of a chat.
 */
export async function updateChatDraftInput(
  db: AgentDb,
  chatId: string,
  content: string | null,
): Promise<void> {
  await db
    .update(schema.chats)
    .set({ draftInputContent: content })
    .where(eq(schema.chats.id, chatId));
}

/**
 * Delete a chat by ID. Messages are automatically deleted via CASCADE.
 */
export async function deleteChat(db: AgentDb, chatId: string): Promise<void> {
  await db.delete(schema.chats).where(eq(schema.chats.id, chatId));
}

/**
 * Get a paginated list of chat summaries, ordered by most recently updated.
 */
export async function getChatSummaries(
  db: AgentDb,
  limit: number,
  offset: number,
): Promise<ChatSummary[]> {
  const rows = await db
    .select({
      id: schema.chats.id,
      title: schema.chats.title,
      createdAt: schema.chats.createdAt,
      updatedAt: schema.chats.updatedAt,
    })
    .from(schema.chats)
    .orderBy(desc(schema.chats.updatedAt))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: fromWebKitTimestamp(row.createdAt),
    updatedAt: fromWebKitTimestamp(row.updatedAt),
  }));
}

/**
 * Get the total count of chats in the database.
 */
export async function getChatCount(db: AgentDb): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.chats)
    .get();
  return result?.count ?? 0;
}

/**
 * Insert a new message into the database.
 */
export async function insertMessage(
  db: AgentDb,
  message: NewMessage,
): Promise<void> {
  await db.insert(schema.messages).values(message);
}

/**
 * Update the content of an existing message.
 */
export async function updateMessage(
  db: AgentDb,
  messageId: string,
  content: ChatMessage,
): Promise<void> {
  await db
    .update(schema.messages)
    .set({ content })
    .where(eq(schema.messages.id, messageId));
}

/**
 * Get all messages for a chat, ordered by message index.
 */
export async function getMessagesForChat(
  db: AgentDb,
  chatId: string,
): Promise<Message[]> {
  return await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.chatId, chatId))
    .orderBy(asc(schema.messages.messageIndex));
}

/**
 * Delete all messages for a chat.
 * Note: This is typically handled by CASCADE when deleting the chat,
 * but can be useful for explicit cleanup scenarios.
 */
export async function deleteMessagesForChat(
  db: AgentDb,
  chatId: string,
): Promise<void> {
  await db.delete(schema.messages).where(eq(schema.messages.chatId, chatId));
}

/**
 * Delete all messages for a chat starting from a given message index.
 * Used when undoing/resetting to a previous message.
 */
export async function deleteMessagesFromIndex(
  db: AgentDb,
  chatId: string,
  fromIndex: number,
): Promise<void> {
  await db
    .delete(schema.messages)
    .where(
      and(
        eq(schema.messages.chatId, chatId),
        gte(schema.messages.messageIndex, fromIndex),
      ),
    );
}
