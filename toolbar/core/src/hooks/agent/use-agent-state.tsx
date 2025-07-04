import { useContext, useEffect, useState } from 'react';
import {
  type AgentState,
  AgentStateType,
} from '@stagewise/agent-interface/toolbar';

import { useAgent } from './use-agent-provider.tsx';
import { type ReactNode, createContext } from 'react';

const fallbackState: AgentState = {
  state: AgentStateType.IDLE,
};

const agentStateContext = createContext<AgentState>(fallbackState);

export function AgentStateProvider({ children }: { children?: ReactNode }) {
  const agent = useAgent().connected;
  const [state, setState] = useState<AgentState>(fallbackState);

  useEffect(() => {
    if (agent !== null) {
      agent.agent.state.getState.subscribe(undefined, {
        onData: (value) => {
          setState(value);
        },
        onError: () => {
          setState(fallbackState);
        },
      });
    } else {
      setState(fallbackState);
    }
  }, [agent]);

  return (
    <agentStateContext.Provider value={state}>
      {children}
    </agentStateContext.Provider>
  );
}

export const useAgentState = () => useContext(agentStateContext);
