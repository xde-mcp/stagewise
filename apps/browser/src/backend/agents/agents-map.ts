import { AgentTypes } from '@shared/karton-contracts/ui/agent';
import { ChatAgent } from './chat';
import { StagewiseMdAgent } from './stagewise-md/stagewise-md';

export type AgentTypeMap = {
  [AgentTypes.CHAT]: typeof ChatAgent;
  [AgentTypes.STAGEWISE_MD]: typeof StagewiseMdAgent;
};

export const AgentsMap = {
  [AgentTypes.CHAT]: ChatAgent,
  [AgentTypes.STAGEWISE_MD]: StagewiseMdAgent,
} as const satisfies AgentTypeMap;
