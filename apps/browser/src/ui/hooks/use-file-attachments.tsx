import {
  useState,
  useCallback,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { fileToDataUrl, generateId, validateFileBeforeUpload } from '@/utils';
import { fileAttachmentToAttachmentAttributes } from '@/utils/attachment-conversions';
import type { FileAttachment } from '@shared/karton-contracts/ui/agent/metadata';
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
  addFileAttachment: (file: File) => Promise<FileAttachment>;
  /** Remove a file attachment by ID */
  removeFileAttachment: (id: string) => void;
  /** Clear all file attachments */
  clearFileAttachments: () => void;
  /** Direct state setter for advanced use cases (e.g., restoring from message) */
  setFileAttachments: Dispatch<SetStateAction<FileAttachment[]>>;
}

/**
 * Hook for managing file attachment state.
 * Each consumer gets their own independent state instance.
 *
 * Features:
 * - Data URL storage for file attachments
 * - Optional automatic insertion into TipTap editor
 * - Early validation before data URL conversion to prevent memory waste
 */
export function useFileAttachments(
  options: UseFileAttachmentsOptions = {},
): UseFileAttachmentsReturn {
  const { chatInputRef, insertIntoEditor = true } = options;

  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);

  const addFileAttachment = useCallback(
    async (file: File): Promise<FileAttachment> => {
      const id = generateId();
      const mediaType = file.type;

      // Validate BEFORE converting to data URL to avoid memory waste
      const validation = validateFileBeforeUpload(file);

      // Only convert to data URL if the file is supported
      // For unsupported files, store empty URL to save memory
      const url = validation.supported ? await fileToDataUrl(file) : '';

      const attachment: FileAttachment = {
        id,
        mediaType,
        fileName: file.name,
        url,
        validationError: validation.supported ? undefined : validation.reason,
      };

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
    setFileAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearFileAttachments = useCallback(() => {
    setFileAttachments([]);
  }, []);

  return {
    fileAttachments,
    addFileAttachment,
    removeFileAttachment,
    clearFileAttachments,
    setFileAttachments,
  };
}
