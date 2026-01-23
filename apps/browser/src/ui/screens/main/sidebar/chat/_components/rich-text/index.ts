import { Extension } from '@tiptap/core';
import { FileAttachment } from './nodes/file-attachment';
import { ImageAttachment } from './nodes/image-attachment';
import { ElementAttachment } from './nodes/element-attachment';
import { TextClipAttachment } from './nodes/text-clip-attachment';
import {
  type AttachmentAttributes,
  type AttachmentNodeOptions,
  ATTACHMENT_NODE_NAMES,
} from './types';

// Types
export type {
  AttachmentAttributes,
  AttachmentType,
  AttachmentNodeOptions,
  BaseAttachmentAttrs,
  FileAttachmentAttrs,
  ImageAttachmentAttrs,
  ElementAttachmentAttrs,
  TextClipAttachmentAttrs,
  AttachmentNodeName,
} from './types';

export {
  ATTACHMENT_NODE_NAMES,
  NODE_NAME_TO_TYPE,
  ALL_ATTACHMENT_NODE_NAMES,
} from './types';

// Individual nodes
export { FileAttachment } from './nodes/file-attachment';
export { ImageAttachment } from './nodes/image-attachment';
export { ElementAttachment } from './nodes/element-attachment';
export { TextClipAttachment } from './nodes/text-clip-attachment';

// Node view component
export { AttachmentNodeView } from './base-attachment-fallback-view';

// View utilities for building custom NodeView components
export {
  useEditorEditable,
  truncateLabel,
  BadgeContainer,
  AttachmentBadge,
  AttachmentBadgeWrapper,
  type BadgeContainerProps,
  type AttachmentBadgeProps,
  type AttachmentBadgeWrapperProps,
} from './view-utils';

/**
 * Array of all attachment node extensions.
 * Use this to register all attachment types with the editor.
 *
 * @example
 * ```typescript
 * const editor = useEditor({
 *   extensions: [
 *     StarterKit,
 *     ...AllAttachmentExtensions.map(ext =>
 *       ext.configure({ onNodeDeleted: handleDelete })
 *     ),
 *   ],
 * });
 * ```
 */
export const AllAttachmentExtensions = [
  FileAttachment,
  ImageAttachment,
  ElementAttachment,
  TextClipAttachment,
] as const;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    attachmentCommands: {
      /**
       * Insert an attachment at the current cursor position.
       * Routes to the correct node type based on the `type` attribute.
       */
      insertAttachment: (attrs: AttachmentAttributes) => ReturnType;
    };
    textClipAttachment: {
      /**
       * Resolves a text clip node back to plain text.
       * Finds the node by ID and replaces it with its content attribute.
       */
      resolveTextClip: (id: string) => ReturnType;
    };
  }
}

/**
 * Extension that provides a unified `insertAttachment` command.
 * This command routes to the correct node type based on the attachment's `type` attribute.
 */
export const AttachmentCommands = Extension.create({
  name: 'attachmentCommands',

  addCommands() {
    return {
      insertAttachment:
        (attrs: AttachmentAttributes) =>
        ({ chain }) => {
          // Determine the correct node type based on the discriminator
          const nodeName = ATTACHMENT_NODE_NAMES[attrs.type];

          // Build the attributes without the 'type' discriminator
          // (since type is determined by the node name now)
          const { type: _type, ...nodeAttrs } = attrs;

          return chain()
            .insertContent([
              {
                type: nodeName,
                attrs: nodeAttrs,
              },
              {
                type: 'text',
                text: ' ',
              },
            ])
            .run();
        },
    };
  },
});

/**
 * Configure all attachment extensions with the same options.
 *
 * @param options - Options to apply to all attachment extensions
 * @returns Array of configured attachment extensions plus the command extension
 *
 * @example
 * ```typescript
 * const editor = useEditor({
 *   extensions: [
 *     StarterKit,
 *     ...configureAttachmentExtensions({
 *       onNodeDeleted: (id, type) => console.log('Deleted:', id, type),
 *     }),
 *   ],
 * });
 * ```
 */
export function configureAttachmentExtensions(options: AttachmentNodeOptions) {
  return [
    FileAttachment.configure(options),
    ImageAttachment.configure(options),
    ElementAttachment.configure(options),
    TextClipAttachment.configure(options),
    AttachmentCommands,
  ];
}
