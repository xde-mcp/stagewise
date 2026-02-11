import { AgentTypes } from '@shared/karton-contracts/ui/agent';
import { ChatAgent } from './chat';
import { ProjectMdAgent } from './project-md/project-md';

export type AgentTypeMap = {
  [AgentTypes.CHAT]: typeof ChatAgent;
  [AgentTypes.PROJECT_MD]: typeof ProjectMdAgent;
};

export const AgentsMap = {
  [AgentTypes.CHAT]: ChatAgent,
  [AgentTypes.PROJECT_MD]: ProjectMdAgent,
} as const satisfies AgentTypeMap;
