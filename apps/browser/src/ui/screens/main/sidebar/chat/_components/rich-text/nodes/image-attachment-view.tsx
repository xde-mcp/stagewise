import { useMemo } from 'react';
import { ImageIcon } from 'lucide-react';
import type { ImageAttachmentAttrs, AttachmentNodeViewProps } from '../types';
import {
  truncateLabel,
  AttachmentBadge,
  AttachmentBadgeWrapper,
} from '../view-utils';
import { PreviewCardContent } from '@stagewise/stage-ui/components/preview-card';
import { useMessageAttachments } from '@ui/hooks/use-message-elements';

/**
 * Custom NodeView for image attachments.
 * Displays a thumbnail icon and shows a larger preview on hover.
 * Looks up attachment data (URL, fileName) from context by ID.
 */
export function ImageAttachmentView(props: AttachmentNodeViewProps) {
  const attrs = props.node.attrs as ImageAttachmentAttrs;

  const isEditable = !('viewOnly' in props);

  // Look up full attachment data from context
  const { fileAttachments } = useMessageAttachments();
  const attachment = useMemo(
    () => fileAttachments.find((f) => f.id === attrs.id),
    [fileAttachments, attrs.id],
  );

  // Prefer context data (saved attachments), fall back to attrs (new attachments being composed)
  const url = attachment?.url ?? attrs.url;
  const label = attachment?.fileName ?? attrs.label;
  const hasError = !!attrs.validationError;
  const hasUrl = !!url;

  const displayLabel = useMemo(
    () => truncateLabel(label, attrs.id),
    [label, attrs.id],
  );

  // Thumbnail icon - show image preview if URL exists, otherwise show placeholder
  const icon = hasUrl ? (
    <div className="relative size-3 shrink-0 overflow-hidden rounded">
      <img src={url} alt={label} className="size-full object-cover" />
    </div>
  ) : (
    <ImageIcon className="size-3 shrink-0" />
  );

  // Preview card showing larger image on hover (only if URL exists)
  const previewContent = hasUrl ? (
    <PreviewCardContent className="flex w-64 flex-col items-stretch gap-2">
      <div className="flex min-h-24 w-full items-center justify-center overflow-hidden rounded-sm bg-background ring-1 ring-border-subtle">
        <img
          src={url}
          className="max-h-36 max-w-full object-contain"
          alt={label}
        />
      </div>
      <span className="font-medium text-foreground text-xs">{label}</span>
    </PreviewCardContent>
  ) : undefined;

  return (
    <AttachmentBadgeWrapper
      viewOnly={!isEditable}
      previewContent={previewContent}
      errorMessage={attrs.validationError}
    >
      <AttachmentBadge
        icon={icon}
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
