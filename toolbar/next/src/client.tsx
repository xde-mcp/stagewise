'use client';

import dynamic from 'next/dynamic';

// Using dynamic import in a client component context
export const StagewiseToolbar = dynamic(
  () =>
    import('@stagewise/react').then((mod: any) => ({
      default: mod.StagewiseToolbar,
    })),
  { ssr: false },
);
