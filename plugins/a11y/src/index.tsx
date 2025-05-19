'use client';

import type { ToolbarPlugin } from '@stagewise/toolbar';
import { A11yComponent } from './component';

export const A11yPlugin: ToolbarPlugin = {
  displayName: 'A11y',
  pluginName: 'a11y',
  description: 'Accessibility Checker',
  iconSvg: null,
  onActionClick: () => <A11yComponent />,
};
