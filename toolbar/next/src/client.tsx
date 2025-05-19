'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { ToolbarConfig } from './types';

const DynamicToolbar = dynamic(
  () =>
    import('@stagewise/toolbar-react').then((mod) => ({
      default: mod.StagewiseToolbar,
    })),
  { ssr: false },
);

export const StagewiseToolbar: ComponentType<{
  config?: ToolbarConfig;
}> = ({ config }) => {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return <DynamicToolbar config={config} />;
};
