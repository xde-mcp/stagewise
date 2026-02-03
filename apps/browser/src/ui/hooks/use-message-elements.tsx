import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SelectedElement } from '@shared/selected-elements';
import type {
  FileAttachment,
  TextClipAttachment,
} from '@shared/karton-contracts/ui/metadata';

/**
 * Context for providing all attachment data within a message scope.
 * This allows child components (attachment views) to access attachment data
 * without prop drilling or rehydration.
 *
 * In view mode, data comes from message metadata.
 * In edit mode, data comes from local state + Karton state.
 */

interface MessageAttachmentsContext {
  /** Selected DOM elements */
  elements: SelectedElement[];
  /** File/image attachments with URLs */
  fileAttachments: FileAttachment[];
  /** Text clip attachments with content */
  textClipAttachments: TextClipAttachment[];
}

const MessageAttachmentsContext = createContext<MessageAttachmentsContext>({
  elements: [],
  fileAttachments: [],
  textClipAttachments: [],
});

interface MessageAttachmentsProviderProps {
  children: ReactNode;
  /** Selected DOM elements */
  elements: SelectedElement[];
  /** File/image attachments */
  fileAttachments?: FileAttachment[];
  /** Text clip attachments */
  textClipAttachments?: TextClipAttachment[];
}

export function MessageAttachmentsProvider({
  children,
  elements,
  fileAttachments = [],
  textClipAttachments = [],
}: MessageAttachmentsProviderProps) {
  const value = useMemo(
    () => ({ elements, fileAttachments, textClipAttachments }),
    [elements, fileAttachments, textClipAttachments],
  );

  return (
    <MessageAttachmentsContext.Provider value={value}>
      {children}
    </MessageAttachmentsContext.Provider>
  );
}

/**
 * Hook to access all attachment data in the current message scope.
 * Returns empty arrays if used outside of a MessageAttachmentsProvider.
 */
export function useMessageAttachments() {
  return useContext(MessageAttachmentsContext);
}
