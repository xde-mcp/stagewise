import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { ToolbarConfig } from '../config';
import type { ComponentChildren } from 'preact';

const ConfigContext = createContext<ToolbarConfig | undefined>(undefined);

export function ConfigProvider({
  config,
  children,
}: { config?: ToolbarConfig; children: ComponentChildren }) {
  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  );
}

export function useConfig(): ToolbarConfig | undefined {
  return useContext(ConfigContext);
}
