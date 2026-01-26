import { useMemo } from 'react';
import type { ImageAttachmentAttrs, AttachmentNodeViewProps } from '../types';
import {
  truncateLabel,
  AttachmentBadge,
  AttachmentBadgeWrapper,
} from '../view-utils';
import { PreviewCardContent } from '@stagewise/stage-ui/components/preview-card';

/**
 * Custom NodeView for image attachments.
 * Displays a thumbnail icon and shows a larger preview on hover.
 */
export function ImageAttachmentView(props: AttachmentNodeViewProps) {
  const attrs = props.node.attrs as ImageAttachmentAttrs;

  const isEditable = !('viewOnly' in props);

  const displayLabel = useMemo(
    () => truncateLabel(attrs.label, attrs.id),
    [attrs.label, attrs.id],
  );

  // Thumbnail icon showing a small preview of the image
  const icon = (
    <span className="relative size-3 shrink-0 overflow-hidden rounded">
      <img
        src={attrs.url}
        alt={attrs.label}
        className="size-full object-cover"
      />
    </span>
  );

  // Preview card showing larger image on hover
  const previewContent = (
    <PreviewCardContent className="flex w-64 flex-col items-stretch gap-2">
      <div className="flex min-h-24 w-full items-center justify-center overflow-hidden rounded-sm bg-background ring-1 ring-border-subtle">
        <img
          src={attrs.url}
          className="max-h-36 max-w-full object-contain"
          alt={attrs.label}
        />
      </div>
      <span className="font-medium text-foreground text-xs">{attrs.label}</span>
    </PreviewCardContent>
  );

  return (
    <AttachmentBadgeWrapper
      viewOnly={!isEditable}
      previewContent={previewContent}
    >
      <AttachmentBadge
        icon={icon}
        label={displayLabel}
        selected={props.selected}
        isEditable={isEditable}
        onDelete={() =>
          'deleteNode' in props ? props.deleteNode() : undefined
        }
      />
    </AttachmentBadgeWrapper>
  );
}
