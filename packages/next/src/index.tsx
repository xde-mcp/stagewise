'use client';
import dynamic from 'next/dynamic';
import React from 'react';

export const StagewiseToolbar = dynamic(
  () =>
    import('@stagewise/toolbar-react').then(
      (mod) => mod.default as React.ComponentType,
    ),
  {
    ssr: false,
  },
);
