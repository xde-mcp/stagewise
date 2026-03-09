import { IconLaptopMobileFillDuo18 } from 'nucleo-ui-fill-duo-18';
import { PanelContainer } from '../primitives';
import type { WidgetProps } from './types';

export function DeviceEmulationWidget({ tab, sortableProps }: WidgetProps) {
  const { isDragging, dragHandleProps } = sortableProps;

  return (
    <PanelContainer
      id="device-emulation"
      tabUrl={tab.url}
      ariaLabel="Device Emulation Tools"
      title="Device Emulation"
      icon={<IconLaptopMobileFillDuo18 className="size-5" />}
      dragHandleProps={dragHandleProps}
      isDragging={isDragging}
    >
      Device emulation coming soon. Use Chrome devtools for now.
    </PanelContainer>
  );
}
