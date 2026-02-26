import { useMemo } from 'react';
import type { InlineNodeViewProps } from '../../shared/types';
import { getRenderer } from '@ui/components/attachment-renderers';
import type { BadgeProps } from '@ui/components/attachment-renderers';
import { useMessageAttachments } from '@ui/hooks/use-message-elements';
import { useOpenAgent } from '@ui/hooks/use-open-chat';

interface AttachmentAttrs {
  id: string;
  label: string;
  mediaType: string;
}

export function AttachmentRegistryNodeView(props: InlineNodeViewProps) {
  const attrs = props.node.attrs as AttachmentAttrs;
  const isEditable = !('viewOnly' in props);
  const [openAgent] = useOpenAgent();

  const { fileAttachments } = useMessageAttachments();
  const attachment = useMemo(
    () => fileAttachments.find((f) => f.id === attrs.id),
    [fileAttachments, attrs.id],
  );

  const mediaType = attachment?.mediaType ?? attrs.mediaType;
  const fileName = attachment?.fileName ?? attrs.label;
  const sizeBytes = attachment?.sizeBytes ?? 0;
  const blobUrl = openAgent ? `sw-blob://${openAgent}/${attrs.id}` : '';

  const renderer = getRenderer(mediaType);

  const badgeProps: BadgeProps = {
    attachmentId: attrs.id,
    mediaType,
    fileName,
    sizeBytes,
    blobUrl,
    params: {},
    viewOnly: !isEditable,
    selected: props.selected,
    onDelete: () => ('deleteNode' in props ? props.deleteNode() : undefined),
  };

  return <renderer.Badge {...badgeProps} />;
}
