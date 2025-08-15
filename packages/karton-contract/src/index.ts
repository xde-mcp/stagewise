import type { UserMessageMetadata, SelectedElement } from './metadata.js';
import type { UIMessage } from 'ai';
import type { Tool } from '@stagewise/agent-types';
import type { RouterOutputs } from '@stagewise/api-client';

export type ChatMessage = UIMessage<UserMessageMetadata>;
export type { UserMessageMetadata, SelectedElement };

export type {
  TextUIPart,
  FileUIPart,
  ReasoningUIPart,
  DynamicToolUIPart,
} from 'ai';

export type History = ChatMessage[];

type ChatId = string;

export type Chat = {
  title: string;
  createdAt: Date;
  messages: History;
  error?: AgentError;
};

export enum AgentErrorType {
  INSUFFICIENT_CREDITS = 'insufficient-credits-message',
  AGENT_ERROR = 'agent-error',
  OTHER = 'other',
}

export type AgentError = {
  type: AgentErrorType;
  error: Error;
};

type AppState = {
  activeChatId: ChatId | null;
  chats: Record<ChatId, Chat>;
  toolCallApprovalRequests: string[];
  isWorking: boolean;
  subscription?: RouterOutputs['subscription']['getSubscription'];
};

export type KartonContract = {
  state: AppState;
  clientProcedures: {
    getAvailableTools: () => Promise<Tool[]>;
  };
  serverProcedures: {
    createChat: () => Promise<string>;
    switchChat: (chatId: string) => Promise<void>;
    deleteChat: (chatId: string) => Promise<void>;
    sendUserMessage: (message: ChatMessage) => Promise<void>;
    retrySendingUserMessage: () => Promise<void>;
    abortAgentCall: () => Promise<void>;
    approveToolCall: (toolCallId: string) => Promise<void>;
    rejectToolCall: (toolCallId: string) => Promise<void>;
    refreshSubscription: () => Promise<void>;
  };
};
