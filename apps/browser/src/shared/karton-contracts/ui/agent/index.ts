import type { ToolUIPart, UIDataTypes, UIMessage } from 'ai';
import type { ModelId } from '@shared/available-models';
import type { UserMessageMetadata } from './metadata';
import type { StagewiseUITools } from './tools/types';

export enum AgentTypes {
  CHAT = 'chat',
  STAGEWISE_MD = 'stagewise-md',
}

export type AgentMessage = UIMessage<
  UserMessageMetadata,
  UIDataTypes,
  StagewiseUITools
>;

export type AgentToolUIPart = ToolUIPart<StagewiseUITools>;

export type AgentState = {
  title: string; // The title of the agent - may not be necessary
  isWorking: boolean; // Whether the agent is currently working on a task or if it's idling (either finished or waiting for user input).
  history: AgentMessage[]; // The message history of the agent (visible to user)
  compactedHistory: AgentMessage[] | undefined; // The compacted message history of the agent (not visible to user, potentially empty)
  lastCompactedMessageId: string | undefined; // The ID of the last message that was compacted
  queuedMessages: (AgentMessage & { role: 'user' })[]; // Queued messages that have not yet been sent to the agent.
  activeModelId: ModelId; // The model ID that the agent last used
  inputState: string; // Serialized input state - may be simple text or some stringified object if our input field needs that.
  usedTokens: number;
};

export type ToolboxState = {
  pendingFiles: string[];
  // Later on, tool calls that involve interaction with the user should also be placed here!!!
};

export type AgentHistoryEntry = {
  id: string; // agent instance ID
  title: string; // agent title
  createdAt: Date; // agent creation timestamp
  lastMessageAt: Date; // last message timestamp
  messageCount: number; // number of messages in the agent's history
  parentAgentInstanceId: string | null; // parent agent instance ID
};
