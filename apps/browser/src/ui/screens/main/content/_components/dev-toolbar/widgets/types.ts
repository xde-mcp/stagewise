import type { TabState } from '@shared/karton-contracts/ui';
import type { WidgetId } from '@shared/karton-contracts/ui/shared-types';
import type { SortableRenderProps } from '../primitives';

// Re-export WidgetId for convenience
export type { WidgetId };

export interface WidgetProps {
  tab: TabState;
  sortableProps: SortableRenderProps;
}

export type WidgetComponent = React.ComponentType<WidgetProps>;
