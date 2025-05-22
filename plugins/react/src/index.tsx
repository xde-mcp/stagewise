'use client';
import type { ToolbarPlugin } from '@stagewise/toolbar';
import { ReactLogo } from './logo';
import { getReactComponentHierarchy } from './utils';

const getSelectedElementAnnotation = (element: HTMLElement) => {
  const annotation = getReactComponentHierarchy(element)[0]?.name;
  return { annotation: annotation ?? null };
};

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

const getSelectedElementsPrompt = (elements: HTMLElement[]) => {
  const selectedComponentHierarchies = elements.map((e) =>
    getReactComponentHierarchy(e),
  );

  if (selectedComponentHierarchies.some((h) => h.length > 0)) {
    const content = `This is additional information on the elements that the user selected. Use this information to find the correct element in the codebase.

  ${selectedComponentHierarchies.map((h, index) => {
    return `
<element index="${index + 1}">
  ${h.length === 0 ? 'No React component as parent detected' : `React component tree (from closest to farthest, 3 closest elements): ${h.map((c) => `{name: ${c.name}, type: ${c.type}}`).join(' child of ')}`}
</element>
    `;
  })}
  `;

    return content;
  }

  return null;
};
