import { IconCircleArrowsOppositeDirectionFillDuo18 } from 'nucleo-ui-fill-duo-18';
import { ToggleButton } from '../primitives';
import type { WidgetProps } from './types';

export function NetworkToolsWidget({ sortableProps }: WidgetProps) {
  const { isDragging, dragHandleProps } = sortableProps;

  return (
    <ToggleButton
      ariaLabel="Network Tools"
      disabled
      icon={<IconCircleArrowsOppositeDirectionFillDuo18 className="size-5" />}
      onClick={() => {}}
      dragHandleProps={dragHandleProps}
      isDragging={isDragging}
    />
  );
}
