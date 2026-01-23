/**
 * Base attributes shared by all attachment types.
 */
export interface BaseAttachmentAttrs {
  id: string;
  label: string;
}

/**
 * Attributes for file attachments (non-image files).
 */
export interface FileAttachmentAttrs extends BaseAttachmentAttrs {}

/**
 * Attributes for image attachments.
 */
export interface ImageAttachmentAttrs extends BaseAttachmentAttrs {
  /** Data URL or blob URL for the image */
  url: string;
}

/**
 * Attributes for selected element attachments.
 */
export interface ElementAttachmentAttrs extends BaseAttachmentAttrs {}

/**
 * Attributes for text clip attachments (collapsed long text).
 */
export interface TextClipAttachmentAttrs extends BaseAttachmentAttrs {
  /** The full pasted text content */
  content: string;
}

/**
 * Union type for all attachment attributes with type discriminator.
 * Used for type-safe handling of different attachment types.
 */
export type AttachmentAttributes =
  | (FileAttachmentAttrs & { type: 'file' })
  | (ImageAttachmentAttrs & { type: 'image' })
  | (ElementAttachmentAttrs & { type: 'element' })
  | (TextClipAttachmentAttrs & { type: 'textClip' });

export type AttachmentType = AttachmentAttributes['type'];

/**
 * Node type names used in the ProseMirror schema.
 * Maps from the attachment type to the node name.
 */
export const ATTACHMENT_NODE_NAMES = {
  file: 'fileAttachment',
  image: 'imageAttachment',
  element: 'elementAttachment',
  textClip: 'textClipAttachment',
} as const;

/**
 * Type for valid attachment node names.
 */
export type AttachmentNodeName =
  (typeof ATTACHMENT_NODE_NAMES)[keyof typeof ATTACHMENT_NODE_NAMES];

/**
 * Reverse mapping from node name to attachment type.
 */
export const NODE_NAME_TO_TYPE: Record<AttachmentNodeName, AttachmentType> = {
  fileAttachment: 'file',
  imageAttachment: 'image',
  elementAttachment: 'element',
  textClipAttachment: 'textClip',
};

/**
 * Array of all attachment node names for iteration.
 */
export const ALL_ATTACHMENT_NODE_NAMES = Object.values(
  ATTACHMENT_NODE_NAMES,
) as AttachmentNodeName[];

/**
 * Configuration options for attachment nodes.
 */
export interface AttachmentNodeOptions {
  /** Called when an attachment node is removed from the document */
  onNodeDeleted?: (id: string, type: AttachmentType) => void;
}
