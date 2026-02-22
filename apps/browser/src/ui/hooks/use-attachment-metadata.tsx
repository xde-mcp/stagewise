import { type ReactNode, createContext, useContext, useMemo } from 'react';

import type {
  FileAttachment,
  TextClipAttachment,
  UserMessageMetadata,
} from '@shared/karton-contracts/ui/agent/metadata';
import type { AgentMessage } from '@shared/karton-contracts/ui/agent';

type AttachmentId = string;

// Use the actual type from metadata for selected elements (inferred from schema)
type SelectedPreviewElement = NonNullable<
  UserMessageMetadata['selectedPreviewElements']
>[number];

export type AttachmentMetadata =
  | SelectedPreviewElement
  | FileAttachment
  | TextClipAttachment;

interface AttachmentMetadataContextValue {
  attachmentMetadata: Record<AttachmentId, AttachmentMetadata>;
}

const AttachmentMetadataContext =
  createContext<AttachmentMetadataContextValue | null>(null);

interface AttachmentMetadataProviderProps {
  children: ReactNode;
  messages: AgentMessage[];
}

export const AttachmentMetadataProvider = ({
  children,
  messages,
}: AttachmentMetadataProviderProps) => {
  const attachmentMetadata = useMemo(() => {
    const record: Record<AttachmentId, AttachmentMetadata> = {};

    for (const message of messages) {
      // Collect file attachments
      message.metadata?.fileAttachments?.forEach((f) => {
        record[f.id] = f;
      });
      // Collect text clips
      message.metadata?.textClipAttachments?.forEach((t) => {
        record[t.id] = t;
      });
      // Collect selected elements
      message.metadata?.selectedPreviewElements?.forEach((e) => {
        if (e.stagewiseId) record[e.stagewiseId] = e;
      });
      // Collect _customFileAttachments from sandbox tool outputs
      for (const part of message.parts) {
        if (
          (part.type.startsWith('tool-') || part.type === 'dynamic-tool') &&
          'output' in part &&
          part.output &&
          typeof part.output === 'object'
        ) {
          const custom = (part.output as Record<string, unknown>)
            ._customFileAttachments;
          if (Array.isArray(custom))
            for (const att of custom as FileAttachment[]) record[att.id] = att;
        }
      }
    }

    return record;
  }, [messages]);

  const value = useMemo(
    () => ({
      attachmentMetadata,
    }),
    [attachmentMetadata],
  );

  return (
    <AttachmentMetadataContext.Provider value={value}>
      {children}
    </AttachmentMetadataContext.Provider>
  );
};

/**
 * Hook to access attachment metadata from all messages in the chat.
 * Returns a record mapping attachment IDs to their metadata (files, text clips, elements).
 */
export function useAttachmentMetadata() {
  const context = useContext(AttachmentMetadataContext);
  if (!context) {
    throw new Error(
      'useAttachmentMetadata must be used within an AttachmentMetadataProvider',
    );
  }
  return context.attachmentMetadata;
}
