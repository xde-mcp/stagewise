import { createAttachmentNode } from '../base-attachment-node';
import { AttachmentRegistryNodeView } from './attachment-view';
import { getAttachmentAnchorText } from '@ui/components/streamdown';

interface AttachmentAttrs {
  mediaType: string;
}

export const Attachment = createAttachmentNode<AttachmentAttrs>({
  name: 'attachment',
  dataTag: 'data-attachment',
  markdownProtocol: 'att',
  additionalAttributes: {
    mediaType: {
      default: 'application/octet-stream',
      parseHTML: (element) => element.getAttribute('data-media-type'),
      renderHTML: (attributes) => ({
        'data-media-type': attributes.mediaType,
      }),
    },
  },
  NodeView: AttachmentRegistryNodeView,
  renderText: ({ node }) => {
    return getAttachmentAnchorText({
      type: 'att',
      id: node.attrs.id,
    });
  },
});
