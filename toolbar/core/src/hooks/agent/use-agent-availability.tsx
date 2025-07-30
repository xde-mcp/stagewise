import { useContext, useEffect, useState } from 'react';
import {
  AgentAvailabilityError,
  type AgentAvailability,
} from '@stagewise/agent-interface/toolbar';
import { useAgents } from './use-agent-provider.tsx';
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
  const { connected: agent, isAppHostedAgent } = useAgents();
  const [availability, setAvailability] = useState<AgentAvailability>({
    isAvailable: false,
    error: AgentAvailabilityError.NO_CONNECTION,
  });

  useEffect(() => {
    // For app-hosted agents, always report as available
    if (isAppHostedAgent) {
      setAvailability({
        isAvailable: true,
      });
      return;
    }

    if (agent !== null) {
      const subscription = agent.agent.availability.getAvailability.subscribe(
        undefined,
        {
          onData: (value) => {
            // Double-check that agent is still available when data arrives
            setAvailability(value);
          },
          onError: () => {
            setAvailability({
              isAvailable: false,
              error: AgentAvailabilityError.NO_CONNECTION,
            });
          },
        },
      );

      // Cleanup function to unsubscribe when agent changes or component unmounts
      return () => {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.debug(
            '[AgentAvailabilityProvider] Error unsubscribing from availability:',
            error,
          );
        }
      };
    } else {
      setAvailability({
        isAvailable: false,
        error: AgentAvailabilityError.NO_CONNECTION,
      });
    }
  }, [agent, isAppHostedAgent]);

  return (
    <agentAvailabilityContext.Provider value={availability}>
      {children}
    </agentAvailabilityContext.Provider>
  );
}

export const useAgentAvailability = () => useContext(agentAvailabilityContext);
