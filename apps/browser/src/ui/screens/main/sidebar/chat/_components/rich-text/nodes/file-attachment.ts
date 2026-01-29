import { createAttachmentNode } from '../base-attachment-node';
import type { FileAttachmentAttrs } from '../types';
import { getAttachmentAnchorText } from '@ui/components/streamdown';

/**
 * File attachment node for non-image files.
 * Renders as an inline badge with a file icon.
 */
export const FileAttachment = createAttachmentNode<FileAttachmentAttrs>({
  name: 'fileAttachment',
  dataTag: 'data-file-attachment',
  additionalAttributes: {
    validationError: {
      default: null,
      parseHTML: (element) => element.getAttribute('data-validation-error'),
      renderHTML: (attributes) => ({
        'data-validation-error': attributes.validationError,
      }),
    },
  },
  renderText: ({ node }) => {
    return getAttachmentAnchorText({
      type: 'file',
      id: node.attrs.id,
    });
  },
});
