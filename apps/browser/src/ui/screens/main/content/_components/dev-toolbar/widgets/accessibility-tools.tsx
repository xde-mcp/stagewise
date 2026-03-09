import { IconAccessibilityFillDuo18 } from 'nucleo-ui-fill-duo-18';
import { ToggleButton } from '../primitives';
import type { WidgetProps } from './types';

export function AccessibilityToolsWidget({ sortableProps }: WidgetProps) {
  const { isDragging, dragHandleProps } = sortableProps;

  return (
    <ToggleButton
      ariaLabel="Accessibility Tools"
      disabled
      icon={<IconAccessibilityFillDuo18 className="size-5" />}
      onClick={() => {}}
      dragHandleProps={dragHandleProps}
      isDragging={isDragging}
    />
  );
}
