import { PluginProvider } from '@/hooks/use-plugins';
import type { InternalToolbarConfig } from '../config';
import { ChatStateProvider } from '@/hooks/use-chat-state';
import type { ReactNode } from 'react';
import { SRPCBridgeProvider } from '@/hooks/use-srpc-bridge';
import { VSCodeProvider } from '@/hooks/use-vscode';
import { ConfigProvider } from '@/hooks/use-config';

export function ContextProviders({
  children,
  config,
}: {
  children?: ReactNode;
  config?: InternalToolbarConfig;
}) {
  return (
    <ConfigProvider config={config}>
      <VSCodeProvider>
        <SRPCBridgeProvider>
          <PluginProvider>
            <ChatStateProvider>{children}</ChatStateProvider>
          </PluginProvider>
        </SRPCBridgeProvider>
      </VSCodeProvider>
    </ConfigProvider>
  );
}
