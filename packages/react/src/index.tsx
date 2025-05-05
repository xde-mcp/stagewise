import { initToolbar, type ToolbarConfig } from '@stagewise/toolbar';
import { useEffect } from 'react';

export function StagewiseToolbar({ config }: { config: ToolbarConfig }) {
  useEffect(() => {
    initToolbar(config);
  }, [config]);

  return null;
}
