import { IconTextSizeFillDuo18 } from 'nucleo-ui-fill-duo-18';
import { ToggleButton } from '../primitives';
import type { WidgetProps } from './types';

export function FontToolsWidget({ sortableProps }: WidgetProps) {
  const { isDragging, dragHandleProps } = sortableProps;

  return (
    <ToggleButton
      ariaLabel="Font Tools"
      disabled
      icon={<IconTextSizeFillDuo18 className="size-5" />}
      onClick={() => {}}
      dragHandleProps={dragHandleProps}
      isDragging={isDragging}
    />
  );
}
