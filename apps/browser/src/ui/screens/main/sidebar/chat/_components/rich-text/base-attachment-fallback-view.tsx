import type { NodeViewProps } from '@tiptap/react';
import { FileIcon } from 'lucide-react';
import { useMemo } from 'react';
import {
  useEditorEditable,
  truncateLabel,
  AttachmentBadge,
  AttachmentBadgeWrapper,
} from './view-utils';

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
export function AttachmentNodeView({
  node,
  deleteNode,
  selected,
  editor,
}: NodeViewProps) {
  const attrs = node.attrs;

  const isEditable = useEditorEditable(editor);

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
    <AttachmentBadgeWrapper tooltipContent={previewContent}>
      <AttachmentBadge
        icon={typeIcon}
        label={displayLabel}
        selected={selected}
        isEditable={isEditable}
        onDelete={deleteNode}
      />
    </AttachmentBadgeWrapper>
  );
}
