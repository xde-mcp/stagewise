import { IconSquareTerminalFillDuo18 } from 'nucleo-ui-fill-duo-18';
import { PanelContainer } from '../primitives';
import type { WidgetProps } from './types';

export function ConsoleWidget({ tab, sortableProps }: WidgetProps) {
  const { isDragging, dragHandleProps } = sortableProps;

  return (
    <PanelContainer
      id="console"
      tabUrl={tab.url}
      ariaLabel="Console"
      title="Console"
      icon={<IconSquareTerminalFillDuo18 className="size-5" />}
      dragHandleProps={dragHandleProps}
      isDragging={isDragging}
    >
      Console coming soon. Use Chrome devtools for now.
    </PanelContainer>
  );
}
