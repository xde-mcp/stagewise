import { createAttachmentNode } from '../base-attachment-node';
import type { ImageAttachmentAttrs } from '../types';
import { ImageAttachmentView } from './image-attachment-view';

/**
 * Image attachment node for image files.
 * Uses a custom view that shows a thumbnail icon and
 * provides a larger image preview on hover.
 */
export const ImageAttachment = createAttachmentNode<ImageAttachmentAttrs>({
  name: 'imageAttachment',
  dataTag: 'data-image-attachment',
  additionalAttributes: {
    url: {
      default: null,
      parseHTML: (element) => element.getAttribute('data-url'),
      renderHTML: (attributes) => ({
        'data-url': attributes.url,
      }),
    },
  },
  NodeView: ImageAttachmentView,
});
