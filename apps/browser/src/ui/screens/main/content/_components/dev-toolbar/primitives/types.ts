import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

export type DragHandleProps = {
  listeners: SyntheticListenerMap | undefined;
  attributes: DraggableAttributes;
};

export type SortableRenderProps = {
  isDragging: boolean;
  dragHandleProps: DragHandleProps;
};
