import { IconPalette2FillDuo18 } from 'nucleo-ui-fill-duo-18';
import { ToggleButton } from '../primitives';
import type { WidgetProps } from './types';

export function ColorToolsWidget({ sortableProps }: WidgetProps) {
  const { isDragging, dragHandleProps } = sortableProps;

  return (
    <ToggleButton
      ariaLabel="Color Tools"
      disabled
      icon={<IconPalette2FillDuo18 className="size-5" />}
      onClick={() => {}}
      dragHandleProps={dragHandleProps}
      isDragging={isDragging}
    />
  );
}
