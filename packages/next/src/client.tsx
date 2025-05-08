'use client';

import dynamic from 'next/dynamic';

export const StagewiseToolbar = dynamic(
  () => import('@stagewise/toolbar-react').then((mod) => mod.StagewiseToolbar),
  { ssr: false },
);
