'use client';
import type { ToolbarPlugin } from '@stagewise/toolbar';
import { ReactLogo } from './logo';
import { getReactComponentName } from './utils';

export const ReactPlugin: ToolbarPlugin = {
  displayName: 'React',
  description:
    'This toolbar adds basic analytical and UI support for apps using React as a UI framework',
  iconSvg: <ReactLogo />,
  pluginName: 'react',
  onContextElementSelect: (element) => {
    const annotation = getReactComponentName(element);
    return {
      annotation,
    };
  },
};
