import type { TabState } from '@shared/karton-contracts/ui';
import type { WidgetId } from '@shared/karton-contracts/ui/shared-types';
import { useCallback } from 'react';
import {
  DndContext,
  pointerWithin,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableWrapper } from '../primitives';
import { widgetRegistry } from '../widgets';
import { useHasOpenPanel, useWidgetOrder } from '../hooks';
import { cn } from '@stagewise/stage-ui/lib/utils';

// Custom collision detection: use pointerWithin first, fall back to closestCenter
const pointerWithinOrClosest: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCenter(args);
};

interface DevToolbarProps {
  tab: TabState;
}

export function DevToolbar({ tab }: DevToolbarProps) {
  const { order, reorderWidgets } = useWidgetOrder();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = order.indexOf(active.id as WidgetId);
        const newIndex = order.indexOf(over.id as WidgetId);
        reorderWidgets(oldIndex, newIndex);
      }
    },
    [order, reorderWidgets],
  );

  const _hasOpenPanel = useHasOpenPanel(tab?.url);

  return (
    <div
      className={cn(
        'scrollbar-thin scrollbar-hover-only flex h-full max-h-full min-h-0 w-full flex-1 shrink-0 flex-col items-end justify-start gap-2 overflow-y-auto px-1 *:shrink-0',
      )}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithinOrClosest}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {order.map((widgetId) => {
            const Widget = widgetRegistry[widgetId];

            if (!Widget) {
              return null;
            }

            return (
              <SortableWrapper key={widgetId} id={widgetId}>
                {(sortableProps) => (
                  <Widget tab={tab} sortableProps={sortableProps} />
                )}
              </SortableWrapper>
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}
