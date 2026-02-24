import { createAttachmentNode } from '../base-attachment-node';
import type { ImageAttachmentAttrs } from '../types';
import { ImageAttachmentView } from './image-attachment-view';
import { getAttachmentAnchorText } from '@ui/components/streamdown';

/**
 * Image attachment node for image files.
 * Uses a custom view that shows a thumbnail icon and
 * provides a larger image preview on hover.
 */
export const ImageAttachment = createAttachmentNode<ImageAttachmentAttrs>({
  name: 'imageAttachment',
  dataTag: 'data-image-attachment',
  markdownProtocol: 'image',
  additionalAttributes: {},
  NodeView: ImageAttachmentView,
  renderText: ({ node }) => {
    return getAttachmentAnchorText({
      type: 'image',
      id: node.attrs.id,
    });
  },
});
