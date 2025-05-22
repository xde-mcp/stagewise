'use client';
import type { ToolbarPlugin } from '@stagewise/toolbar';
import { ReactLogo } from './logo';
import {
  getSelectedElementAnnotation,
  getSelectedElementsPrompt,
} from './utils';

export const ReactPlugin: ToolbarPlugin = {
  displayName: 'React',
  description:
    'This toolbar adds additional information and metadata for apps using React as a UI framework',
  iconSvg: <ReactLogo />,
  pluginName: 'react',
  onContextElementHover: getSelectedElementAnnotation,
  onContextElementSelect: getSelectedElementAnnotation,
  onPromptSend: (prompt) => ({
    contextSnippets: [
      {
        promptContextName: 'elements-react-component-info',
        content: getSelectedElementsPrompt(prompt.contextElements),
      },
    ],
  }),
};


