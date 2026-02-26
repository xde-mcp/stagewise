import { useMemo } from 'react';
import type { InlineNodeViewProps } from '../shared/types';
import type { MentionAttrs } from './types';
import { truncateLabel, InlineBadge, InlineBadgeWrapper } from '../shared';
import { MentionIcon } from './mention-icon';

export function MentionNodeView(props: InlineNodeViewProps) {
  const attrs = props.node.attrs as MentionAttrs;
  const isEditable = !('viewOnly' in props);

  const displayLabel = useMemo(
    () => truncateLabel(attrs.label, attrs.id),
    [attrs.label, attrs.id],
  );

  return (
    <InlineBadgeWrapper viewOnly={!isEditable} tooltipContent={attrs.id}>
      <InlineBadge
        icon={<MentionIcon providerType={attrs.providerType} id={attrs.id} />}
        label={displayLabel}
        selected={props.selected}
        isEditable={isEditable}
        onDelete={() =>
          'deleteNode' in props ? props.deleteNode() : undefined
        }
      />
    </InlineBadgeWrapper>
  );
}
