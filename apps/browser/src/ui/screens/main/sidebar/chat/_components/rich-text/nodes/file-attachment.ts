import { createAttachmentNode } from '../base-attachment-node';
import type { FileAttachmentAttrs } from '../types';

/**
 * File attachment node for non-image files.
 * Renders as an inline badge with a file icon.
 */
export const FileAttachment = createAttachmentNode<FileAttachmentAttrs>({
  name: 'fileAttachment',
  dataTag: 'data-file-attachment',
  // No additional attributes beyond base (id, label)
});
