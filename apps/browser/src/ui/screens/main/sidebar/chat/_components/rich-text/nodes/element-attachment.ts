import { createAttachmentNode } from '../base-attachment-node';
import type { ElementAttachmentAttrs } from '../types';
import { ElementAttachmentView } from './element-attachment-view';

/**
 * Element attachment node for selected DOM elements.
 * Uses a custom view that shows an element selector icon and
 * provides a preview card with element details on hover.
 */
export const ElementAttachment = createAttachmentNode<ElementAttachmentAttrs>({
  name: 'elementAttachment',
  dataTag: 'data-element-attachment',
  NodeView: ElementAttachmentView,
});
