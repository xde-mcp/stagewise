import { ComponentChildren, createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { ToolbarConfig } from '../config';

const PluginContext = createContext<ToolbarConfig['plugins']>([]);

export function PluginProvider({
  children,
  plugins,
}: {
  children: ComponentChildren;
  plugins: ToolbarConfig['plugins'];
}) {
  console.log('PluginProvider rendered!');
  console.log(plugins);
  return (
    <PluginContext.Provider value={plugins}>{children}</PluginContext.Provider>
  );
}

export function usePlugins() {
  const plugin = useContext(PluginContext);
  if (!plugin) throw new Error('No plugin found');
  return plugin;
}
