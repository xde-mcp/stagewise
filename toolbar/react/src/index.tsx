import { initToolbar, type ToolbarConfig } from '@stagewise/core';
import { useEffect, useRef } from 'react';

export type { ToolbarConfig } from '@stagewise/core';

export function StagewiseToolbar({ config }: { config: ToolbarConfig }) {
  const isLoaded = useRef(false);
  useEffect(() => {
    if (isLoaded.current) return;
    isLoaded.current = true;
    initToolbar(config);
  }, [config]);

  return null;
}
