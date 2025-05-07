'use client';
import type { ToolbarConfig } from '@stagewise/core';
export type { ToolbarConfig };
import { initToolbar } from '@stagewise/core';
import { useEffect, useRef } from 'react';

export default function ToolbarWrapper({ config }: { config: ToolbarConfig }) {
  const isLoaded = useRef(false);
  useEffect(() => {
    if (isLoaded.current) return;
    isLoaded.current = true;
    initToolbar(config);
  }, []);
  return null;
}
