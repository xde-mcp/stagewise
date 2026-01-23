import {
  useState,
  useCallback,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { generateId } from '@/utils';
import {
  fileAttachmentToAttachmentAttributes,
  type FileAttachment,
} from '@/utils/attachment-conversions';
import type { ChatInputHandle } from '@/screens/main/sidebar/chat/_components/chat-input';

export interface UseFileAttachmentsOptions {
  /** Reference to the chat input for inserting attachments */
  chatInputRef?: RefObject<ChatInputHandle>;
  /** Whether to automatically insert attachments into the editor (default: true) */
  insertIntoEditor?: boolean;
}

export interface UseFileAttachmentsReturn {
  /** Current file attachments */
  fileAttachments: FileAttachment[];
  /** Add a file attachment, returns the created attachment */
  addFileAttachment: (file: File) => FileAttachment;
  /** Remove a file attachment by ID, revokes blob URL */
  removeFileAttachment: (id: string) => void;
  /** Clear all file attachments, revokes all blob URLs */
  clearFileAttachments: () => void;
  /** Direct state setter for advanced use cases (e.g., restoring from message) */
  setFileAttachments: Dispatch<SetStateAction<FileAttachment[]>>;
}

/**
 * Hook for managing file attachment state with blob URL lifecycle management.
 * Each consumer gets their own independent state instance.
 *
 * Features:
 * - Automatic blob URL creation and cleanup
 * - Optional automatic insertion into TipTap editor
 * - Proper cleanup on removal/clear to prevent memory leaks
 */
export function useFileAttachments(
  options: UseFileAttachmentsOptions = {},
): UseFileAttachmentsReturn {
  const { chatInputRef, insertIntoEditor = true } = options;

  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);

  const addFileAttachment = useCallback(
    (file: File): FileAttachment => {
      const id = generateId();
      const url = URL.createObjectURL(file);
      const attachment: FileAttachment = { id, file, url };

      setFileAttachments((prev) => [...prev, attachment]);

      // Optionally insert into editor
      if (insertIntoEditor && chatInputRef?.current) {
        const attrs = fileAttachmentToAttachmentAttributes(attachment);
        chatInputRef.current.insertAttachment(attrs);
      }

      return attachment;
    },
    [chatInputRef, insertIntoEditor],
  );

  const removeFileAttachment = useCallback((id: string) => {
    setFileAttachments((prev) => {
      const attachment = prev.find((a) => a.id === id);
      // Only revoke blob URLs (not data URLs)
      if (attachment?.url.startsWith('blob:'))
        URL.revokeObjectURL(attachment.url);

      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const clearFileAttachments = useCallback(() => {
    setFileAttachments((prev) => {
      // Only revoke blob URLs (not data URLs)
      prev.forEach((attachment) => {
        if (attachment.url.startsWith('blob:'))
          URL.revokeObjectURL(attachment.url);
      });
      return [];
    });
  }, []);

  return {
    fileAttachments,
    addFileAttachment,
    removeFileAttachment,
    clearFileAttachments,
    setFileAttachments,
  };
}
