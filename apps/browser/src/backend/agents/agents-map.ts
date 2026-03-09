import { AgentTypes } from '@shared/karton-contracts/ui/agent';
import { ChatAgent } from './chat';
import { WorkspaceMdAgent } from './workspace-md/workspace-md';

export type AgentTypeMap = {
  [AgentTypes.CHAT]: typeof ChatAgent;
  [AgentTypes.WORKSPACE_MD]: typeof WorkspaceMdAgent;
};

export const AgentsMap = {
  [AgentTypes.CHAT]: ChatAgent,
  [AgentTypes.WORKSPACE_MD]: WorkspaceMdAgent,
} as const satisfies AgentTypeMap;
