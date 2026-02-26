import { GlobeIcon } from 'lucide-react';
import { FileIcon } from '@ui/components/file-icon';
import type { MentionProvider } from './types';

export const stubFileProvider: MentionProvider = {
  type: 'file',
  groupLabel: 'Files',
  boost: 1.3,
  icon: ({ id, className }) => <FileIcon filePath={id} className={className} />,
  query: () => [
    {
      id: 'src/index.ts',
      label: 'index.ts',
      description: 'src/index.ts',
      relevance: 0.9,
    },
    {
      id: 'src/utils/helpers.ts',
      label: 'helpers.ts',
      description: 'src/utils/helpers.ts',
      relevance: 0.7,
    },
    {
      id: 'src/components/button.tsx',
      label: 'button.tsx',
      description: 'src/components/button.tsx',
    },
    {
      id: 'src/hooks/use-auth.ts',
      label: 'use-auth.ts',
      description: 'src/hooks/use-auth.ts',
    },
    {
      id: 'src/app/layout.tsx',
      label: 'layout.tsx',
      description: 'src/app/layout.tsx',
    },
    {
      id: 'src/lib/api-client.ts',
      label: 'api-client.ts',
      description: 'src/lib/api-client.ts',
    },
    {
      id: 'package.json',
      label: 'package.json',
      description: 'package.json',
    },
    {
      id: 'tsconfig.json',
      label: 'tsconfig.json',
      description: 'tsconfig.json',
    },
  ],
};

export const stubTabProvider: MentionProvider = {
  type: 'tab',
  groupLabel: 'Open Tabs',
  boost: 1.0,
  icon: ({ className }) => <GlobeIcon className={className} />,
  query: () => [
    {
      id: 'tab-1',
      label: 'localhost:3000',
      description: 'My App - Home',
      relevance: 0.8,
    },
    {
      id: 'tab-2',
      label: 'localhost:3000/dashboard',
      description: 'My App - Dashboard',
      relevance: 0.5,
    },
    {
      id: 'tab-3',
      label: 'github.com/stagewise',
      description: 'stagewise - GitHub',
    },
  ],
};
