import type { ToolbarPlugin } from './plugin.ts';

export interface InternalToolbarConfig {
  plugins: ToolbarPlugin[];
  experimental?: {
    /**
     * If true, the toolbar will use the stagewise MCP server.
     */
    enableStagewiseMCP: boolean;
    /**
     * If true, the toolbar will allow tool calls to sync progress with the agent.
     */
    enableToolCalls: boolean;
  };
}

export interface ToolbarPluginLoader {
  loader: true; // Used to identify new plugins that are loaded into the toolbar via loader mechanism
  mainPlugin: string; // The main plugin code that will be loaded into the toolbar
}

export interface ToolbarConfig extends Omit<InternalToolbarConfig, 'plugins'> {
  plugins: ToolbarPluginLoader[];
}
