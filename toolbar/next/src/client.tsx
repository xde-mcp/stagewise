'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { ToolbarConfig } from './types';

// Using dynamic import in a client component context
export const StagewiseToolbar: ComponentType<{ config?: ToolbarConfig }> =
  dynamic(
    () =>
      import('@stagewise/toolbar-react').then((mod: any) => ({
        default: mod.StagewiseToolbar,
      })),
    { ssr: false },
  );
