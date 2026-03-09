import { IconPowerLevelFillDuo18 } from 'nucleo-ui-fill-duo-18';
import { ToggleButton } from '../primitives';
import type { WidgetProps } from './types';

export function PerformanceToolsWidget({ sortableProps }: WidgetProps) {
  const { isDragging, dragHandleProps } = sortableProps;

  return (
    <ToggleButton
      ariaLabel="Performance Tools"
      disabled
      icon={<IconPowerLevelFillDuo18 className="size-5" />}
      onClick={() => {}}
      dragHandleProps={dragHandleProps}
      isDragging={isDragging}
    />
  );
}
