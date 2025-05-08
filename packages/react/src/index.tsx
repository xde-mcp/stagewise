import { initToolbar, type ToolbarConfig } from '@stagewise/toolbar';
import { useEffect, useRef } from 'react';

export type { ToolbarConfig } from '@stagewise/toolbar';

export function StagewiseToolbar({ config }: { config: ToolbarConfig }) {
  const initFlag = useRef(false);
  useEffect(() => {
    if (initFlag.current) return;
    initFlag.current = true;
    initToolbar(config);
  }, [config]);

  return null;
}
