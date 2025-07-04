import { useContext, useEffect, useState } from 'react';
import {
  AgentAvailabilityError,
  type AgentAvailability,
} from '@stagewise/agent-interface/toolbar';
import { useAgent } from './use-agent-provider.tsx';
import { type ReactNode, createContext } from 'react';

const agentAvailabilityContext = createContext<AgentAvailability>({
  isAvailable: false,
  error: AgentAvailabilityError.NO_CONNECTION,
});

export function AgentAvailabilityProvider({
  children,
}: {
  children?: ReactNode;
}) {
  const agent = useAgent().connected;
  const [availability, setAvailability] = useState<AgentAvailability>({
    isAvailable: false,
    error: AgentAvailabilityError.NO_CONNECTION,
  });

  useEffect(() => {
    if (agent !== null) {
      agent.agent.availability.getAvailability.subscribe(undefined, {
        onData: (value) => {
          setAvailability(value);
        },
        onError: () => {
          setAvailability({
            isAvailable: false,
            error: AgentAvailabilityError.NO_CONNECTION,
          });
        },
      });
    } else {
      setAvailability({
        isAvailable: false,
        error: AgentAvailabilityError.NO_CONNECTION,
      });
    }
  }, [agent]);

  return (
    <agentAvailabilityContext.Provider value={availability}>
      {children}
    </agentAvailabilityContext.Provider>
  );
}

export const useAgentAvailability = () => useContext(agentAvailabilityContext);
