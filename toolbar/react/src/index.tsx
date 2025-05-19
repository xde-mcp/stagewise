import { initToolbar, type ToolbarConfig } from '@stagewise/toolbar';
import { useEffect, useRef } from 'react';

export type { ToolbarConfig } from '@stagewise/toolbar';

export function StagewiseToolbar({ config }: { config?: ToolbarConfig }) {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const isLoaded = useRef(false);
  useEffect(() => {
    if (isLoaded.current) return;
    isLoaded.current = true;
    initToolbar(config);
  }, [config]);

  return null;
}
