import posthog from 'posthog-js';
import type { FileUIPart } from '@shared/karton-contracts/ui';
import type { SelectedElement } from '@shared/selected-elements';
import { generateId } from '@/utils';
import type { FileAttachment } from '@shared/karton-contracts/ui/agent/metadata';
import type { AttachmentAttributes } from '@/screens/main/sidebar/chat/_components/rich-text';

/**
 * Convert a data URL to a File object.
 *
 * @param dataUrl - The data URL to convert (e.g., "data:image/jpeg;base64,...")
 * @param filename - The filename to use for the resulting File
 * @returns A File object
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1] ?? '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);

  return new File([u8arr], filename, { type: mime });
}

/**
 * Convert a FileUIPart (from a stored message) to a FileAttachment for editing.
 * Simply preserves the data URL from the stored message.
 *
 * @param filePart - The file part from a ChatMessage
 * @returns A FileAttachment suitable for chat state, or null if conversion failed
 */
export function fileUIPartToFileAttachment(
  filePart: FileUIPart,
): FileAttachment | null {
  try {
    return {
      id: generateId(),
      mediaType: filePart.mediaType,
      fileName: filePart.filename,
      url: filePart.url,
    };
  } catch (e) {
    console.warn(
      '[fileUIPartToFileAttachment] Failed to convert file part to file attachment:',
      e,
    );
    posthog.captureException(e instanceof Error ? e : new Error(String(e)), {
      source: 'renderer',
      operation: 'fileUIPartToFileAttachment',
    });
    return null;
  }
}

/**
 * Convert a FileAttachment to a FileUIPart for sending messages.
 * This converts the blob URL back to a data URL for transmission.
 *
 * @param attachment - The file attachment from chat state
 * @returns A FileUIPart suitable for including in a ChatMessage, or null if conversion failed
 */
export async function fileAttachmentToFileUIPart(
  attachment: FileAttachment,
): Promise<FileUIPart | null> {
  try {
    return {
      type: 'file' as const,
      mediaType: attachment.mediaType,
      filename: attachment.fileName,
      url: attachment.url,
    };
  } catch (e) {
    console.warn(
      '[fileAttachmentToFileUIPart] Failed to convert file attachment to file part:',
      e,
    );
    posthog.captureException(e instanceof Error ? e : new Error(String(e)), {
      source: 'renderer',
      operation: 'fileAttachmentToFileUIPart',
    });
    return null;
  }
}

/**
 * Convert a FileAttachment to AttachmentAttributes for TipTap editor insertion.
 *
 * @param attachment - The file attachment from chat state
 * @returns Attributes for inserting an attachment in the editor
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
      url: attachment.url,
      validationError: attachment.validationError,
    };
  }

  return {
    id: attachment.id,
    type: 'file',
    label: attachment.fileName ?? 'File',
    validationError: attachment.validationError,
  };
}

/**
 * Convert a SelectedElement to AttachmentAttributes for TipTap editor insertion.
 *
 * @param element - The selected element from Karton state
 * @returns Attributes for inserting an element in the editor
 */
export function selectedElementToAttachmentAttributes(
  element: SelectedElement,
): AttachmentAttributes {
  // Build a display label from the element info
  const tagName = (element.nodeType || element.tagName).toLowerCase();
  const domId = element.attributes?.id ? `#${element.attributes.id}` : '';
  const label = `${tagName}${domId}`;

  return {
    id: element.stagewiseId ?? generateId(),
    type: 'element',
    label,
  };
}
