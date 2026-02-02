import type { ChatMessage } from '.';
import type { ModelId } from '@shared/available-models';

export enum AgentTypes {
  CHAT = 'chat',
}

export type AgentState = {
  title: string; // The title of the agent - may not be necessary
  isWorking: boolean; // Whether the agent is currently working on a task or if it's idling (either finished or waiting for user input).
  history: ChatMessage[]; // The message history of the agent (visible to user)
  compactedHistory: ChatMessage[] | undefined; // The compacted message history of the agent (not visible to user, potentially empty)
  lastCompactedMessageId: string | undefined; // The ID of the last message that was compacted
  queuedMessages: (ChatMessage & { role: 'user' })[]; // Queued messages that have not yet been sent to the agent.
  activeModelId: ModelId; // The model ID that the agent last used
  inputState: string; // Serialized input state - may be simple text or some stringified object if our input field needs that.
  usedTokens: number;
};

export type ToolboxState = {
  pendingFiles: string[];
  // Later on, tool calls that involve interaction with the user should also be placed here!!!
};
