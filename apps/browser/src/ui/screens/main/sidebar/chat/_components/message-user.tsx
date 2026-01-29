import {
  fileUIPartToFileAttachment,
  fileAttachmentToFileUIPart,
  selectedElementToAttachmentAttributes,
} from '@/utils/attachment-conversions';
import { cn, collectUserMessageMetadata } from '@/utils';
import type {
  ChatMessage,
  TextUIPart,
  FileUIPart,
} from '@shared/karton-contracts/ui';
import { useMemo, useCallback, memo, useState, useRef, useEffect } from 'react';
import { useKartonProcedure, useKartonState } from '@/hooks/use-karton';
import { useEventListener } from '@/hooks/use-event-listener';
import { useMessageEditState } from '@/hooks/use-message-edit-state';
import { MessageElementsProvider } from '@/hooks/use-message-elements';
import { useFileAttachments } from '@/hooks/use-file-attachments';
import { useDragDrop } from '@/hooks/use-drag-drop';
import { useElementSelectionWatcher } from '@/hooks/use-element-selection-watcher';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
  PopoverFooter,
  PopoverClose,
} from '@stagewise/stage-ui/components/popover';
import { Button } from '@stagewise/stage-ui/components/button';
import type { SelectedElement } from '@shared/selected-elements';
import {
  ChatInput,
  ChatInputActions,
  type ChatInputHandle,
} from './chat-input';
import { ChatInputViewOnly } from './chat-input-view-only';
import { generateId } from 'ai';
import type { AttachmentType } from './rich-text';

type UserMessage = ChatMessage & { role: 'user' };

export const MessageUser = memo(
  function MessageUser({
    message: msg,
    isLastMessage,
    measureRef,
  }: {
    message: UserMessage;
    isLastMessage: boolean;
    measureRef?: (el: HTMLDivElement | null) => void;
  }) {
    const chatInputRef = useRef<ChatInputHandle>(null);
    const [isEditing, setIsEditing] = useState(false);

    // File attachments via shared hook
    const {
      fileAttachments: editedFileAttachments,
      addFileAttachment,
      removeFileAttachment,
      clearFileAttachments,
      setFileAttachments: setEditedFileAttachments,
    } = useFileAttachments({ chatInputRef, insertIntoEditor: true });

    // Message edit state for file drop routing and exposing local elements
    const { registerEditMode, unregisterEditMode } = useMessageEditState();

    // Procedures and state
    const undoEditsUntilUserMessage = useKartonProcedure(
      (p) => p.agentChat.undoEditsUntilUserMessage,
    );
    const sendUserMessage = useKartonProcedure(
      (p) => p.agentChat.sendUserMessage,
    );
    const activeChatId = useKartonState(
      (s) => s.agentChat?.activeChat?.id || null,
    );
    const isWorking = useKartonState((s) => s.agentChat?.isWorking || false);

    // Use message ID for scoping element selection
    const editMessageId = msg.id;

    const [selectedElementsFromEditor, setSelectedElementsFromEditor] =
      useState<SelectedElement[]>([]);

    // Element selector state and procedures
    // Check if THIS input's element selection is active (not just global mode)
    const elementSelectionActive = useKartonState(
      (s) => s.browser.contextSelectionMode,
    );
    const selectedElementsFromWebcontents = useKartonState(
      (s) => s.browser.selectedElements,
    );
    const setElementSelectionActiveProc = useKartonProcedure(
      (p) => p.browser.contextSelection.setActive,
    );
    const setElementSelectionActive = useCallback(
      (active: boolean) => {
        setElementSelectionActiveProc(active);
      },
      [setElementSelectionActiveProc],
    );
    const clearSelectedElementsProc = useKartonProcedure(
      (p) => p.browser.contextSelection.clearElements,
    );
    const clearSelectedElements = useCallback(() => {
      clearSelectedElementsProc();
    }, [clearSelectedElementsProc]);
    const removeSelectedElement = useKartonProcedure(
      (p) => p.browser.contextSelection.removeElement,
    );

    // Watch for pending element screenshots and auto-add as file attachments
    const pendingScreenshots = useKartonState(
      (s) => s.browser.pendingElementScreenshots,
    );
    const clearPendingScreenshotsProc = useKartonProcedure(
      (p) => p.browser.contextSelection.clearPendingScreenshots,
    );

    // Edit mode state with mention IDs
    const [editedText, setEditedText] = useState('');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    // Store original content for reverting on cancel
    const originalTiptapContentRef = useRef<string | null>(null);
    // Store tiptap content when submit is clicked (before confirmation popover)
    const pendingTiptapContentRef = useRef<string | null>(null);

    // Extract text content from message
    const textContent = useMemo(() => {
      return msg.parts
        .filter((part) => part.type === 'text')
        .map((part) => (part as TextUIPart).text)
        .join('\n');
    }, [msg.parts]);

    const fileUIParts = useMemo(() => {
      return msg.parts.filter((part) => part.type === 'file');
    }, [msg.parts]);

    // User messages should not be empty in normal usage
    const isEmptyMessage = useMemo(() => {
      return msg.parts.every(
        (part) =>
          part.type !== 'text' ||
          (part.type === 'text' && part.text.trim() === ''),
      );
    }, [msg.parts]);

    // Can edit when not working and message has an ID
    const canEdit = !isWorking && !!msg.id;

    // Get TipTap JSON content from message metadata
    const tiptapJsonContent = msg.metadata?.tiptapJsonContent as
      | string
      | undefined;

    // Start editing - initialize the editor with message content
    const handleStartEditing = useCallback(() => {
      if (!canEdit || !editMessageId) return;

      // Dispatch event to cancel any other active message edits
      window.dispatchEvent(
        new CustomEvent('message-edit-started', {
          detail: { messageId: editMessageId },
        }),
      );

      // Save original content for reverting on cancel
      // Use the message metadata directly since we don't have an editor in view mode
      originalTiptapContentRef.current = tiptapJsonContent ?? null;

      // Initialize editedText from message text content
      setEditedText(textContent);

      msg.metadata?.selectedPreviewElements?.forEach((element) => {
        setSelectedElementsFromEditor((prev) => [
          ...prev,
          element as SelectedElement,
        ]);
      });

      // Clear Karton state for new element selections
      clearSelectedElements();

      // Convert existing file attachments to FileAttachment format
      const fileAttachments = fileUIParts
        .map(fileUIPartToFileAttachment)
        .filter((a): a is NonNullable<typeof a> => a !== null);
      setEditedFileAttachments(fileAttachments);

      setIsEditing(true);

      // Focus the editor (will be available after state update triggers re-render)
      setTimeout(() => chatInputRef.current?.focus(), 0);
    }, [
      canEdit,
      editMessageId,
      textContent,
      tiptapJsonContent,
      fileUIParts,
      clearSelectedElements,
    ]);

    // Cancel editing
    const handleCancelEditing = useCallback(() => {
      // Check if current content is completely empty by reading directly from the editor
      // getTextContent() returns text with @mentions (e.g., "@element-id"), so if empty,
      // there's no text and no attachment mentions in the editor
      const currentText = chatInputRef.current?.getTextContent() ?? '';
      const isContentEmpty = currentText.trim().length === 0;

      // Only restore original content if the edited content is completely empty
      if (isContentEmpty && originalTiptapContentRef.current)
        chatInputRef.current?.setJsonContent(originalTiptapContentRef.current);

      originalTiptapContentRef.current = null;
      pendingTiptapContentRef.current = null;

      setIsEditing(false);
      setEditedText('');
      clearFileAttachments();
      setIsConfirmOpen(false);
      setElementSelectionActive(false);
      clearSelectedElements();
      setSelectedElementsFromEditor([]);
    }, [
      setElementSelectionActive,
      clearSelectedElements,
      clearFileAttachments,
    ]);

    // Submit triggers confirmation
    const handleSubmitEdit = useCallback(() => {
      if (editedText.trim().length <= 2) return;
      // Capture tiptap content now, before the confirmation popover
      pendingTiptapContentRef.current =
        chatInputRef.current?.getTiptapJsonContent() ?? null;
      setIsConfirmOpen(true);
    }, [editedText]);

    // Confirm and execute the edit
    const handleConfirmEdit = useCallback(async () => {
      if (!msg.id || !activeChatId) return;

      try {
        // First, revert the history
        await undoEditsUntilUserMessage(msg.id, activeChatId);

        const combinedSelectedElements = [
          ...selectedElementsFromWebcontents,
          ...selectedElementsFromEditor,
        ];

        // Convert FileAttachments to FileUIParts
        const fileParts: FileUIPart[] = await Promise.all(
          editedFileAttachments.map(fileAttachmentToFileUIPart),
        );

        const tiptapJsonContent = pendingTiptapContentRef.current ?? undefined;

        // Collect metadata for selected elements and text clips
        const metadata = collectUserMessageMetadata(
          combinedSelectedElements,
          tiptapJsonContent,
        );

        await sendUserMessage({
          id: generateId(),
          parts: [...fileParts, { type: 'text' as const, text: editedText }],
          role: 'user',
          metadata: {
            ...metadata,
            tiptapJsonContent,
          },
        });

        // Dispatch event to force scroll to bottom in chat history
        window.dispatchEvent(new Event('chat-message-sent'));

        // Reset edit state (clearFileAttachments handles blob URL cleanup)
        setIsEditing(false);
        setEditedText('');
        clearFileAttachments();
        setIsConfirmOpen(false);
        setElementSelectionActive(false);
        clearSelectedElements();
        setSelectedElementsFromEditor([]);
        pendingTiptapContentRef.current = null;
      } catch (error) {
        console.warn('Failed to edit message:', error);
      }
    }, [
      msg.id,
      activeChatId,
      undoEditsUntilUserMessage,
      sendUserMessage,
      editedText,
      selectedElementsFromWebcontents,
      editedFileAttachments,
      setElementSelectionActive,
      clearSelectedElements,
      clearFileAttachments,
    ]);

    // Handle files pasted in editor
    const handlePasteFiles = useCallback(
      (files: File[]) => {
        files.forEach((file) => {
          addFileAttachment(file);
        });
      },
      [addFileAttachment],
    );

    const handleRemoveAttachment = useCallback(
      (id: string, type: AttachmentType) => {
        if (type === 'file') {
          removeFileAttachment(id);
        } else if (type === 'element') {
          removeSelectedElement(id);
          setSelectedElementsFromEditor((prev) =>
            prev.filter((el) => el.stagewiseId !== id),
          );
        }
      },
      [removeFileAttachment, removeSelectedElement],
    );

    // Auto-add pending element screenshots as file attachments during edit mode
    useEffect(() => {
      if (pendingScreenshots.length === 0) return;
      // We might auto-add pending element screenshots as file attachments in the future, it's disabled for now
      // Clear processed screenshots from state
      void clearPendingScreenshotsProc();
    }, [pendingScreenshots, clearPendingScreenshotsProc]);

    // Watch for selected elements via shared hook
    useElementSelectionWatcher({
      isActive: isEditing,
      onNewElement: useCallback(
        (element: SelectedElement) => {
          const attrs = selectedElementToAttachmentAttributes(element);
          chatInputRef.current?.insertAttachment(attrs);
        },
        [chatInputRef],
      ),
    });

    // Element selector toggle
    const handleToggleElementSelection = useCallback(() => {
      setElementSelectionActive(!elementSelectionActive);
    }, [elementSelectionActive, setElementSelectionActive]);

    // Drag and drop via shared hook
    const { isDragOver: isEditDragOver, handlers: editDragHandlers } =
      useDragDrop({
        onFileDrop: addFileAttachment,
        onDropComplete: () => chatInputRef.current?.focus(),
      });

    // Focus the input when entering edit mode
    useEffect(() => {
      if (!isEditing) return;
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 0);
    }, [isEditing]);

    // Track if input was focused before app lost focus (for restoring on app regain)
    const wasActiveBeforeAppBlurRef = useRef(false);

    const onEditInputFocus = useCallback(() => {
      // Clear the app blur flag since we're now focused
      wasActiveBeforeAppBlurRef.current = false;
    }, []);

    const onEditInputBlur = useCallback(
      (ev: FocusEvent) => {
        const target = ev.relatedTarget as HTMLElement;
        if (target?.closest('#chat-file-attachment-menu-content')) return;

        if (
          !target ||
          (!target.closest('.message-user-edit-container') &&
            !target.closest('#element-selector-element-canvas'))
        ) {
          // If relatedTarget is null, the app might be losing focus (e.g., CMD+tab)
          // Track this so we can restore focus when the app regains focus
          if (!target && isEditing) wasActiveBeforeAppBlurRef.current = true;
        } else if (isEditing) chatInputRef.current?.focus();
      },
      [isEditing],
    );

    // Restore focus when the app regains focus (e.g., after CMD+tab back)
    useEventListener(
      'focus',
      () => {
        if (isEditing && wasActiveBeforeAppBlurRef.current) {
          wasActiveBeforeAppBlurRef.current = false;
          chatInputRef.current?.focus();
        }
      },
      {},
      window,
    );

    // Global escape key handler for edit mode
    useEffect(() => {
      if (!isEditing) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          handleCancelEditing();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [isEditing, handleCancelEditing]);

    // Cancel edit when main chat input is focused
    useEventListener('cancel-all-message-edits', () => {
      if (isEditing) handleCancelEditing();
    });

    // Cancel edit when another message starts editing
    useEventListener(
      'message-edit-started',
      (e: CustomEvent<{ messageId: string }>) => {
        if (isEditing && e.detail.messageId !== editMessageId) {
          handleCancelEditing();
        }
      },
    );

    // Register/unregister edit mode for drop event routing
    useEffect(() => {
      if (isEditing && editMessageId) {
        // Register the useDragDrop handler so forwarded events get the same processing
        registerEditMode(editMessageId, editDragHandlers.onDrop);
      }
      return () => {
        if (editMessageId) {
          unregisterEditMode(editMessageId);
        }
      };
    }, [
      isEditing,
      editMessageId,
      editDragHandlers.onDrop,
      registerEditMode,
      unregisterEditMode,
    ]);

    // Can send when text is long enough
    const canSendMessage = editedText.trim().length > 2;

    // Check if on internal page (for element selector)
    const activeTabId = useKartonState((s) => s.browser.activeTabId);
    const tabs = useKartonState((s) => s.browser.tabs);
    const activeTab = useMemo(() => {
      return tabs[activeTabId];
    }, [tabs, activeTabId]);

    const hasOpenedInternalPage = useMemo(() => {
      return activeTab?.url?.startsWith('stagewise://internal/') ?? false;
    }, [activeTab?.url]);

    // Count total attachments for display
    const totalAttachments =
      editedFileAttachments.length + selectedElementsFromWebcontents.length;

    // Combine all available elements for the preview card to access
    // In view mode: from message metadata
    // In edit mode: from local state + Karton state
    const allAvailableElements = useMemo(() => {
      const metadataElements =
        (msg.metadata?.selectedPreviewElements as SelectedElement[]) ?? [];
      if (isEditing) {
        // During editing, combine all sources (deduped by stagewiseId)
        const combined = [
          ...metadataElements,
          ...selectedElementsFromEditor,
          ...selectedElementsFromWebcontents,
        ];
        const seen = new Set<string>();
        return combined.filter((el) => {
          if (seen.has(el.stagewiseId)) return false;
          seen.add(el.stagewiseId);
          return true;
        });
      }
      // In view mode, just use metadata
      return metadataElements;
    }, [
      msg.metadata?.selectedPreviewElements,
      isEditing,
      selectedElementsFromEditor,
      selectedElementsFromWebcontents,
    ]);

    if (isEmptyMessage && !isLastMessage) return null;

    // Conditional rendering: view-only mode uses lightweight renderer, edit mode uses full TipTap
    return (
      <MessageElementsProvider elements={allAvailableElements}>
        <div
          className={cn('flex w-full flex-col gap-1')}
          onDrop={isEditing ? editDragHandlers.onDropBubble : undefined} // Reset drag state, let event bubble to ChatPanel
          onDragOver={isEditing ? editDragHandlers.onDragOver : undefined}
          onDragEnter={isEditing ? editDragHandlers.onDragEnter : undefined}
          onDragLeave={isEditing ? editDragHandlers.onDragLeave : undefined}
        >
          <div ref={measureRef} className="w-full">
            <div
              className={cn(
                'mt-2 flex w-full shrink-0 flex-row-reverse items-stretch justify-start gap-1',
                isEmptyMessage ? 'hidden' : '',
              )}
            >
              {/* Container with conditional styling for view/edit modes */}
              <div
                className={cn(
                  'message-user-edit-container relative flex flex-row items-stretch gap-1 overflow-y-hidden',
                  // Edit mode: full width input field style
                  isEditing &&
                    'w-full rounded-md bg-background p-2 shadow-[0_0_6px_0_rgba(0,0,0,0.05),0_-6px_48px_-24px_rgba(0,0,0,0.08)] ring-1 ring-derived-strong before:absolute before:inset-0 before:rounded-lg dark:bg-surface-1',
                  isEditing && isEditDragOver && 'bg-hover-derived!',
                  !isEditing &&
                    'group wrap-break-word max-w-xl origin-bottom-right select-text rounded-lg rounded-br-sm border border-derived bg-surface-1 px-2.5 py-1.5 font-normal text-foreground text-sm last:mb-0.5 dark:bg-surface-tinted',
                  !isEditing &&
                    canEdit &&
                    'group/chat-message-user cursor-pointer hover:bg-hover-derived active:bg-active-derived',
                )}
                onClick={!isEditing && canEdit ? handleStartEditing : undefined}
                role={!isEditing && canEdit ? 'button' : undefined}
                tabIndex={!isEditing && canEdit ? 0 : undefined}
                onKeyDown={
                  !isEditing && canEdit
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleStartEditing();
                        }
                      }
                    : undefined
                }
              >
                {/* View mode: lightweight static renderer */}
                {!isEditing && (
                  <ChatInputViewOnly
                    tiptapJsonContent={tiptapJsonContent}
                    textContent={textContent}
                    className="w-full"
                  />
                )}
                {/* Edit mode: full TipTap editor */}
                {isEditing && (
                  <>
                    <ChatInput
                      ref={chatInputRef}
                      value={editedText}
                      onChange={setEditedText}
                      initialJsonContent={tiptapJsonContent}
                      onSubmit={handleSubmitEdit}
                      onEscape={handleCancelEditing}
                      placeholder="Edit your message..."
                      showModelSelect
                      onModelChange={() => chatInputRef.current?.focus()}
                      showContextUsageRing={false}
                      attachmentCount={totalAttachments}
                      onFocus={onEditInputFocus}
                      onBlur={onEditInputBlur}
                      onPasteFiles={handlePasteFiles}
                      onAttachmentRemoved={handleRemoveAttachment}
                      className="w-full"
                    />
                    {/* Action buttons */}
                    <div className="relative flex shrink-0 flex-col items-center justify-end gap-1">
                      <ChatInputActions
                        isAgentWorking={false}
                        hasTextInput={editedText.trim().length > 0}
                        showElementSelectorButton
                        elementSelectionActive={elementSelectionActive}
                        onToggleElementSelection={handleToggleElementSelection}
                        elementSelectorDisabled={hasOpenedInternalPage}
                        showImageUploadButton
                        onAddFileAttachment={addFileAttachment}
                        canSendMessage={canSendMessage}
                        onSubmit={handleSubmitEdit}
                        isActive
                      />
                      {/* Popover anchor positioned at the send button */}
                      <Popover
                        open={isConfirmOpen}
                        onOpenChange={setIsConfirmOpen}
                      >
                        <PopoverTrigger>
                          <span className="pointer-events-none absolute right-0 bottom-0 size-8" />
                        </PopoverTrigger>
                        <PopoverContent>
                          <PopoverTitle>Resend message?</PopoverTitle>
                          <PopoverDescription>
                            This will clear the chat history and undo file
                            changes after this point, then send your edited
                            message.
                          </PopoverDescription>
                          <PopoverClose />
                          <PopoverFooter>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => setIsConfirmOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={handleConfirmEdit}
                            >
                              Resend
                            </Button>
                          </PopoverFooter>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </MessageElementsProvider>
    );
  },
  // Custom comparison to prevent re-renders when message object references change
  (prevProps, nextProps) => {
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.isLastMessage !== nextProps.isLastMessage) return false;
    if (!!prevProps.measureRef !== !!nextProps.measureRef) return false;
    // Check if tiptapJsonContent changed (used for TipTap initialization)
    if (
      prevProps.message.metadata?.tiptapJsonContent !==
      nextProps.message.metadata?.tiptapJsonContent
    )
      return false;
    if (prevProps.message.parts.length !== nextProps.message.parts.length)
      return false;

    for (let i = 0; i < prevProps.message.parts.length; i++) {
      const prevPart = prevProps.message.parts[i];
      const nextPart = nextProps.message.parts[i];
      if (!prevPart || !nextPart) return false;
      if (prevPart.type !== nextPart.type) return false;

      if (prevPart.type === 'text' && nextPart.type === 'text') {
        if (prevPart.text !== nextPart.text) return false;
        if (prevPart.state !== nextPart.state) return false;
      }
    }

    return true;
  },
);
