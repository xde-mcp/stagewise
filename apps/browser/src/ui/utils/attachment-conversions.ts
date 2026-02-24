import type { SelectedElement } from '@shared/selected-elements';
import { generateId } from '@/utils';
import type { FileAttachment } from '@shared/karton-contracts/ui/agent/metadata';
import type { AttachmentAttributes } from '@/screens/main/sidebar/chat/_components/rich-text';

/**
 * Convert a FileAttachment to AttachmentAttributes for TipTap editor insertion.
 */
export function fileAttachmentToAttachmentAttributes(
  attachment: FileAttachment,
): AttachmentAttributes {
  const isImage = attachment.mediaType.startsWith('image/');

  if (isImage) {
    return {
      id: attachment.id,
      type: 'image',
      label: attachment.fileName ?? 'Image',
    };
  }

  return {
    id: attachment.id,
    type: 'file',
    label: attachment.fileName ?? 'File',
  };
}

/**
 * Convert a SelectedElement to AttachmentAttributes for TipTap editor insertion.
 */
export function selectedElementToAttachmentAttributes(
  element: SelectedElement,
): AttachmentAttributes {
  const tagName = (element.nodeType || element.tagName).toLowerCase();
  const domId = element.attributes?.id ? `#${element.attributes.id}` : '';
  const label = `${tagName}${domId}`;

  return {
    id: element.stagewiseId ?? generateId(),
    type: 'element',
    label,
  };
}
