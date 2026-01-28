-- VERSION: 1

CREATE TABLE IF NOT EXISTS meta(
  key LONGVARCHAR NOT NULL UNIQUE PRIMARY KEY,
  value LONGVARCHAR
);

CREATE TABLE IF NOT EXISTS chats(
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Chat',
  last_used_model_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  draft_input_content TEXT
);

CREATE INDEX IF NOT EXISTS chats_created_at_index ON chats(created_at);
CREATE INDEX IF NOT EXISTS chats_updated_at_index ON chats(updated_at);

CREATE TABLE IF NOT EXISTS messages(
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  message_index INTEGER NOT NULL,
  content TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_chat_id_index ON messages(chat_id);
CREATE INDEX IF NOT EXISTS messages_chat_order_index ON messages(chat_id, message_index);
