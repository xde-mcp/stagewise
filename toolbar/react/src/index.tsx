import { initToolbar, type ToolbarConfig } from '@stagewise/core';
import { useEffect } from 'react';

export type { ToolbarConfig } from '@stagewise/core';

export function StagewiseToolbar({ config }: { config: ToolbarConfig }) {
  useEffect(() => {
    initToolbar(config);
  }, [config]);

  return null;
}
