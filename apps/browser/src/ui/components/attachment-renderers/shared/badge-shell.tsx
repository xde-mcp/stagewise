import { useMemo, type ReactNode } from 'react';
import type { BadgeProps } from '../types';
import {
  truncateLabel,
  AttachmentBadge,
  AttachmentBadgeWrapper,
} from '@ui/screens/main/sidebar/chat/_components/rich-text/view-utils';

interface BadgeShellProps extends BadgeProps {
  icon: ReactNode;
  previewContent?: ReactNode;
  tooltipContent?: ReactNode;
}

export function BadgeShell({
  attachmentId,
  fileName,
  icon,
  previewContent,
  tooltipContent,
  viewOnly,
  selected,
  onDelete,
}: BadgeShellProps) {
  const displayLabel = useMemo(
    () => truncateLabel(fileName, attachmentId),
    [fileName, attachmentId],
  );

  return (
    <AttachmentBadgeWrapper
      viewOnly={viewOnly}
      previewContent={previewContent}
      tooltipContent={tooltipContent}
    >
      <AttachmentBadge
        icon={icon}
        label={displayLabel}
        selected={selected ?? false}
        isEditable={!viewOnly}
        onDelete={onDelete ?? (() => {})}
      />
    </AttachmentBadgeWrapper>
  );
}
