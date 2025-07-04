import { PluginProvider } from '@/hooks/use-plugins';
import type { InternalToolbarConfig } from '../config';
import { ChatStateProvider } from '@/hooks/use-chat-state';
import type { ReactNode } from 'react';
import { ConfigProvider } from '@/hooks/use-config';
import { AgentProvider } from '@/hooks/agent/use-agent-provider';
import { AgentAvailabilityProvider } from '@/hooks/agent/use-agent-availability';
import { AgentStateProvider } from '@/hooks/agent/use-agent-state';
import { AgentMessagingProvider } from '@/hooks/agent/use-agent-messaging';

export function ContextProviders({
  children,
  config,
}: {
  children?: ReactNode;
  config?: InternalToolbarConfig;
}) {
  return (
    <ConfigProvider config={config}>
      <AgentProvider>
        <AgentAvailabilityProvider>
          <AgentStateProvider>
            <AgentMessagingProvider>
              <PluginProvider>
                <ChatStateProvider>{children}</ChatStateProvider>
              </PluginProvider>
            </AgentMessagingProvider>
          </AgentStateProvider>
        </AgentAvailabilityProvider>
      </AgentProvider>
    </ConfigProvider>
  );
}
