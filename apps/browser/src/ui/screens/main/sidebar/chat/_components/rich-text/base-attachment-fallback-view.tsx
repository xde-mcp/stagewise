import { FileIcon } from 'lucide-react';
import { useMemo } from 'react';
import {
  truncateLabel,
  AttachmentBadge,
  AttachmentBadgeWrapper,
} from './view-utils';
import type { AttachmentNodeViewProps, FileAttachmentAttrs } from './types';

/**
 * AttachmentNodeView is the default view component for attachment nodes.
 * It renders an attachment as an inline badge with an icon, truncated label,
 * and X button on hover for removal.
 *
 * This view handles file and image attachment types. Attachment types with
 * more complex rendering needs (like element attachments) should define
 * their own custom NodeView component.
 *
 * Note: Node deletion notifications are handled at the ProseMirror plugin level
 * in base-attachment-node.ts, not here. This component is purely presentational.
 */
export function AttachmentNodeView(props: AttachmentNodeViewProps) {
  const attrs = props.node.attrs as FileAttachmentAttrs;

  const isEditable = !('viewOnly' in props);
  const hasError = !!attrs.validationError;

  const displayLabel = useMemo(
    () => truncateLabel(attrs.label, attrs.id),
    [attrs.label, attrs.id],
  );

  // Default: file icon
  const typeIcon = <FileIcon className="size-3 shrink-0" />;

  // Render preview card content based on attachment type
  const previewContent = useMemo(() => {
    return <span>{attrs.label}</span>;
  }, [attrs.label]);

  return (
    <AttachmentBadgeWrapper
      viewOnly={!isEditable}
      tooltipContent={previewContent}
      errorMessage={attrs.validationError}
    >
      <AttachmentBadge
        icon={typeIcon}
        label={displayLabel}
        selected={props.selected}
        isEditable={isEditable}
        hasError={hasError}
        onDelete={() =>
          'deleteNode' in props ? props.deleteNode() : undefined
        }
      />
    </AttachmentBadgeWrapper>
  );
}
