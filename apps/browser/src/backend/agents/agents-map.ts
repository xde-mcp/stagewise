import { AgentTypes } from '@shared/karton-contracts/ui/agent';
import { ChatAgent } from './chat';

export type AgentTypeMap = {
  [AgentTypes.CHAT]: typeof ChatAgent;
};

export const AgentsMap = {
  [AgentTypes.CHAT]: ChatAgent,
} as const satisfies AgentTypeMap;
