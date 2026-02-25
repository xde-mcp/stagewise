import {
  useState,
  useCallback,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { generateId } from '@/utils';
import { fileAttachmentToAttachmentAttributes } from '@/utils/attachment-conversions';
import type { FileAttachment } from '@shared/karton-contracts/ui/agent/metadata';
import type { ChatInputHandle } from '@/screens/main/sidebar/chat/_components/chat-input';
import { useKartonProcedure } from '@/hooks/use-karton';
import posthog from 'posthog-js';

const MAX_BASE64_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

/**
 * Resolve the absolute filesystem path for a File object.
 * Uses Electron's webUtils.getPathForFile() exposed via the preload bridge.
 * Returns an empty string for clipboard-pasted or programmatically constructed Files.
 */
function getFilePath(file: File): string {
  try {
    return (window as any).electron?.getPathForFile?.(file) ?? '';
  } catch {
    return '';
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const commaIdx = dataUrl.indexOf(',');
      resolve(commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface UseFileAttachmentsOptions {
  /** Reference to the chat input for inserting attachments */
  chatInputRef?: RefObject<ChatInputHandle>;
  /** Whether to automatically insert attachments into the editor (default: true) */
  insertIntoEditor?: boolean;
  /** Agent instance ID — required for storing blobs on disk */
  agentId?: string | null;
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
 * File content is stored on disk via the `agents.storeAttachment` procedure.
 * Only lightweight metadata is kept in React state and Karton state.
 */
export function useFileAttachments(
  options: UseFileAttachmentsOptions = {},
): UseFileAttachmentsReturn {
  const { chatInputRef, insertIntoEditor = true, agentId } = options;

  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>([]);
  const storeAttachment = useKartonProcedure((p) => p.agents.storeAttachment);
  const storeAttachmentByPath = useKartonProcedure(
    (p) => p.agents.storeAttachmentByPath,
  );

  const addFileAttachment = useCallback(
    async (file: File): Promise<FileAttachment> => {
      const id = generateId();
      const mediaType = file.type || 'application/octet-stream';
      const fileName = file.name || `file-${id}`;
      const sizeBytes = file.size;

      const attachment: FileAttachment = {
        id,
        fileName,
        mediaType,
        sizeBytes,
      };

      setFileAttachments((prev) => [...prev, attachment]);

      if (insertIntoEditor && chatInputRef?.current) {
        const attrs = fileAttachmentToAttachmentAttributes(attachment);
        chatInputRef.current.insertAttachment(attrs);
      }

      if (agentId) {
        const filePath = getFilePath(file);
        let storePromise: Promise<void>;
        if (filePath) {
          storePromise = storeAttachmentByPath(
            agentId,
            id,
            mediaType,
            fileName,
            sizeBytes,
            filePath,
          );
        } else if (sizeBytes > MAX_BASE64_FILE_SIZE) {
          storePromise = Promise.reject(
            new Error(
              `File "${fileName}" (${(sizeBytes / 1024 / 1024).toFixed(0)} MB) is too large for in-memory transfer. ` +
                'Drop the file from Finder to use zero-copy transfer.',
            ),
          );
        } else {
          storePromise = fileToBase64(file).then((base64) =>
            storeAttachment(
              agentId,
              id,
              mediaType,
              fileName,
              sizeBytes,
              base64,
            ),
          );
        }

        storePromise.catch((err: unknown) => {
          console.error(
            '[useFileAttachments] Failed to store attachment blob:',
            err,
          );
          posthog.captureException(
            err instanceof Error ? err : new Error(String(err)),
            {
              source: 'renderer',
              operation: 'storeAttachmentBlob',
              attachmentId: id,
              agentId,
            },
          );
        });
      }

      return attachment;
    },
    [
      chatInputRef,
      insertIntoEditor,
      agentId,
      storeAttachment,
      storeAttachmentByPath,
    ],
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
