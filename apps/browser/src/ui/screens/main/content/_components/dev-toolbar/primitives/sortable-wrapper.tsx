import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties } from 'react';
import type { SortableRenderProps } from './types';

export function SortableWrapper({
  id,
  children,
}: {
  id: string;
  children: (props: SortableRenderProps) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    // Use Translate only (not Transform) to avoid scale values shrinking the element
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex w-full justify-end">
      {children({
        isDragging,
        dragHandleProps: { attributes, listeners },
      })}
    </div>
  );
}
