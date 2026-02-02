import { AgentTypes } from '@shared/karton-contracts/ui/agent';
import { ChatAgent } from './chat';

export const AgentsMap = {
  [AgentTypes.CHAT]: ChatAgent,
};
