import { IconPalette2FillDuo18 } from 'nucleo-ui-fill-duo-18';
import { PanelContainer } from '../../primitives';
import type { WidgetProps } from '../types';
import { useKartonProcedure } from '@/hooks/use-karton';

import { ColorPicker } from './color-picker';

export function ColorToolsWidget({ tab, sortableProps }: WidgetProps) {
  const { isDragging, dragHandleProps } = sortableProps;

  const getScreenshot = useKartonProcedure(
    (p) => p.browser.devTools.getScreenshot,
  );

  return (
    <PanelContainer
      id="color-tools"
      tabUrl={tab.url}
      ariaLabel="Color Tools"
      title="Color Tools"
      icon={<IconPalette2FillDuo18 className="size-5" />}
      dragHandleProps={dragHandleProps}
      isDragging={isDragging}
    >
      <ColorPicker tabId={tab.id} getScreenshot={getScreenshot} />
    </PanelContainer>
  );
}
