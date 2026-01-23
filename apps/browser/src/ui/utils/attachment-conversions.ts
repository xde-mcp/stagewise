import type { FileUIPart } from '@shared/karton-contracts/ui';
import type { SelectedElement } from '@shared/selected-elements';
import { fileToDataUrl, generateId } from '@/utils';
import type { AttachmentAttributes } from '@/screens/main/sidebar/chat/_components/rich-text';

/**
 * File attachment as stored in chat state.
 */
export interface FileAttachment {
  id: string;
  file: File;
  url: string;
}

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
 * Fetches the data URL and creates a blob URL for display.
 *
 * @param filePart - The file part from a ChatMessage
 * @returns A FileAttachment suitable for chat state, or null if conversion failed
 */
export async function fileUIPartToFileAttachment(
  filePart: FileUIPart,
): Promise<FileAttachment | null> {
  try {
    const response = await fetch(filePart.url);
    const blob = await response.blob();
    const file = new File([blob], filePart.filename, {
      type: filePart.mediaType,
    });
    const blobUrl = URL.createObjectURL(file);

    return {
      id: generateId(),
      file,
      url: blobUrl,
    };
  } catch (e) {
    console.warn(
      '[fileUIPartToFileAttachment] Failed to convert file part to file attachment:',
      e,
    );
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
      mediaType: attachment.file.type,
      filename: attachment.file.name,
      url: await fileToDataUrl(attachment.file),
    };
  } catch (e) {
    console.warn(
      '[fileAttachmentToFileUIPart] Failed to convert file attachment to file part:',
      e,
    );
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
  const isImage = attachment.file.type.startsWith('image/');

  if (isImage) {
    return {
      id: attachment.id,
      type: 'image',
      label: attachment.file.name,
      url: attachment.url,
    };
  }

  return {
    id: attachment.id,
    type: 'file',
    label: attachment.file.name,
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

/**
 * Convert a blob URL to a data URL by fetching the blob and reading it as base64.
 *
 * @param blobUrl - The blob URL to convert
 * @returns A data URL string, or the original URL if conversion fails
 */
async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('[blobUrlToDataUrl] Failed to convert blob URL:', e);
    return blobUrl; // Return original on failure
  }
}

/**
 * TipTap JSON node structure (simplified).
 */
interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
}

/**
 * Recursively transform a TipTap JSON node, converting blob URLs in imageAttachment
 * nodes to data URLs.
 *
 * @param node - The TipTap node to transform
 * @returns The transformed node with data URLs
 */
async function transformTiptapNode(node: TiptapNode): Promise<TiptapNode> {
  // If this is an imageAttachment node with a blob URL, convert it
  if (
    node.type === 'imageAttachment' &&
    node.attrs?.url &&
    typeof node.attrs.url === 'string' &&
    node.attrs.url.startsWith('blob:')
  ) {
    const dataUrl = await blobUrlToDataUrl(node.attrs.url);
    return {
      ...node,
      attrs: {
        ...node.attrs,
        url: dataUrl,
      },
    };
  }

  // Recursively transform content array
  if (node.content && Array.isArray(node.content)) {
    const transformedContent = await Promise.all(
      node.content.map((child) => transformTiptapNode(child)),
    );
    return {
      ...node,
      content: transformedContent,
    };
  }

  return node;
}

/**
 * Transform TipTap JSON content, converting all blob URLs in imageAttachment nodes
 * to data URLs. This ensures the content can be persisted and displayed even after
 * the original blob URLs are revoked.
 *
 * @param jsonContent - The TipTap JSON content string
 * @returns The transformed JSON content string with data URLs
 */
export async function transformTiptapBlobUrls(
  jsonContent: string | undefined | null,
): Promise<string | undefined> {
  if (!jsonContent) return undefined;

  try {
    const doc = JSON.parse(jsonContent) as TiptapNode;
    const transformedDoc = await transformTiptapNode(doc);
    return JSON.stringify(transformedDoc);
  } catch (e) {
    console.warn('[transformTiptapBlobUrls] Failed to transform content:', e);
    return jsonContent; // Return original on failure
  }
}
