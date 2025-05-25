import { type ComponentChildren, createContext } from 'preact';
import { useContext, useEffect, useMemo, useRef } from 'preact/hooks';
import type { ToolbarContext, ToolbarPlugin } from '@/plugin';
import { collectMcpServersFromPlugins } from '@/plugin';
import { useSRPCBridge } from './use-srpc-bridge';
import type { PromptRequest } from '@stagewise/extension-toolbar-srpc-contract';
import { useVSCode } from './use-vscode';

export interface PluginContextType {
  plugins: ToolbarPlugin[];
  toolbarContext: ToolbarContext;
}

const PluginContext = createContext<PluginContextType>({
  plugins: [],
  toolbarContext: {
    sendPrompt: () => {},
  },
});

export function PluginProvider({
  children,
  plugins,
}: {
  children: ComponentChildren;
  plugins: ToolbarPlugin[];
}) {
  const { bridge } = useSRPCBridge();
  const { selectedSession } = useVSCode();

  const toolbarContext = useMemo(() => {
    return {
      sendPrompt: async (prompt: string | PromptRequest) => {
        if (!bridge) throw new Error('No connection to the agent');

        const result = await bridge.call.triggerAgentPrompt(
          typeof prompt === 'string'
            ? {
                prompt,
                ...(selectedSession && {
                  sessionId: selectedSession.sessionId,
                }),
              }
            : {
                prompt: prompt.prompt,
                model: prompt.model,
                files: prompt.files,
                images: prompt.images,
                mode: prompt.mode,
                ...(selectedSession && {
                  sessionId: selectedSession.sessionId,
                }),
              },
          {
            onUpdate: (update) => {},
          },
        );
      },
    };
  }, [bridge, selectedSession]);

  // call plugins once on initial load
  const pluginsLoadedRef = useRef(false);
  const mcpRegisteredRef = useRef(false);

  useEffect(() => {
    if (pluginsLoadedRef.current) return;
    pluginsLoadedRef.current = true;
    plugins.forEach((plugin) => {
      plugin.onLoad?.(toolbarContext);
    });
  }, [plugins, toolbarContext]);

  // Register MCP servers when bridge is available and plugins are loaded
  useEffect(() => {
    if (!bridge || mcpRegisteredRef.current || !pluginsLoadedRef.current)
      return;

    const mcpServers = collectMcpServersFromPlugins(plugins);
    if (mcpServers.length > 0) {
      mcpRegisteredRef.current = true;

      // Register MCP servers with the extension
      bridge.call
        .registerMCP(
          {
            servers: mcpServers,
            source: 'toolbar-plugins',
          },
          {
            onUpdate: (update) => {
              console.log('MCP registration update:', update.updateText);
            },
          },
        )
        .then(() => {
          console.log(
            `Successfully registered ${mcpServers.length} MCP servers from plugins:`,
            mcpServers.map((s) => s.name).join(', '),
          );
        })
        .catch((error) => {
          console.error('Failed to register MCP servers from plugins:', error);
          mcpRegisteredRef.current = false; // Allow retry
        });
    }
  }, [bridge, plugins]);

  const value = useMemo(() => {
    return {
      plugins,
      toolbarContext,
    };
  }, [plugins, toolbarContext]);

  return (
    <PluginContext.Provider value={value}>{children}</PluginContext.Provider>
  );
}

export function usePlugins() {
  return useContext(PluginContext);
}
