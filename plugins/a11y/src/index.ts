'use client';

import type { ToolbarPlugin } from '@stagewise/toolbar';
import { ToolbarAction } from './ui/actionButton';

export const A11yPlugin: ToolbarPlugin = {
  displayName: 'A11y',
  pluginName: 'a11y',
  description: 'Accessibility Checker',
  iconSvg: null,

  onLoad: (toolbar) => {
    toolbar.renderToolbarAction(ToolbarAction);
    toolbar.renderToolbarAction(ToolbarAction);
    toolbar.renderToolbarAction(ToolbarAction);
    const handle = toolbar.renderToolbarAction(ToolbarAction);

    handle.remove();
  },
};
