import { StatusCard } from './footer-status-card';
import type { SelectedElement } from '@shared/selected-elements';
import { useMessageEditState } from '@/hooks/use-message-edit-state';
import { useFileAttachments } from '@/hooks/use-file-attachments';
import { useDragDrop } from '@/hooks/use-drag-drop';
import { useElementSelectionWatcher } from '@/hooks/use-element-selection-watcher';
import { cn, generateId, collectUserMessageMetadata } from '@/utils';
import { HotkeyActions } from '@shared/hotkeys';
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  useKartonState,
  useKartonProcedure,
  useKartonConnected,
  useKartonReconnectState,
  useComparingSelector,
} from '@/hooks/use-karton';
import { useHotKeyListener } from '@/hooks/use-hotkey-listener';
import { useEventListener } from '@/hooks/use-event-listener';
import {
  ChatInput,
  ChatInputActions,
  type ChatInputHandle,
} from './chat-input';
import type { AttachmentType } from '@/screens/main/sidebar/chat/_components/rich-text';
import {
  selectedElementToAttachmentAttributes,
  fileUIPartToFileAttachment,
} from '@/utils/attachment-conversions';
import type { ChatMessage } from '@shared/karton-contracts/ui';
import { useChatDraft } from '@/hooks/use-chat-draft';

export function ChatPanelFooter() {
  const chatInputRef = useRef<ChatInputHandle>(null);
  const prevChatIdRef = useRef<string | null>(null);
  const prevDraftRef = useRef<string | undefined>(undefined);

  const [chatInput, setChatInput] = useState<string>('');
  const [localSelectedElements, setLocalSelectedElements] = useState<
    SelectedElement[]
  >([]);

  // File attachments via shared hook
  const {
    fileAttachments,
    addFileAttachment,
    removeFileAttachment,
    clearFileAttachments,
    setFileAttachments,
  } = useFileAttachments({ chatInputRef });

  const { activeEditMessageId, setMainDropHandler } = useMessageEditState();

  const { isWorking, activeChat } = useKartonState(
    useComparingSelector((s) => ({
      activeChat: s.agentChat?.activeChat,
      isWorking: s.agentChat?.isWorking,
    })),
  );

  // Restore draft when activeChat changes (after switch or create)
  useEffect(() => {
    const currentChatId = activeChat?.id ?? null;
    const currentDraft = activeChat?.draftInputContent;

    const chatChanged = currentChatId !== prevChatIdRef.current;
    const draftChanged = currentDraft !== prevDraftRef.current;

    // Skip if nothing changed
    if (!chatChanged && !draftChanged) return;

    // Update refs
    prevChatIdRef.current = currentChatId;
    prevDraftRef.current = currentDraft;

    if (!currentChatId) return;

    // Clear file attachments and selected elements only on chat switch
    if (chatChanged) {
      clearFileAttachments();
      setLocalSelectedElements([]);
    }

    // Restore draft from the newly loaded chat (or when draft becomes available)
    if (currentDraft) chatInputRef.current?.setJsonContent(currentDraft);
    else if (chatChanged) {
      // Only clear input on chat change (not when draft becomes undefined)
      chatInputRef.current?.clear();
      setChatInput('');
    }
  }, [activeChat?.id, activeChat?.draftInputContent, clearFileAttachments]);

  // Register draft getter with context (for switch/create in sibling components)
  const { registerDraftGetter } = useChatDraft();
  useEffect(() => {
    return registerDraftGetter(
      () => chatInputRef.current?.getTiptapJsonContent() ?? '',
    );
  }, [registerDraftGetter]);

  const activeTabId = useKartonState((s) => s.browser.activeTabId);
  const tabs = useKartonState((s) => s.browser.tabs);
  const activeTab = useMemo(() => {
    return tabs[activeTabId];
  }, [tabs, activeTabId]);

  // Element selection state from Karton
  const selectionModeActive = useKartonState(
    (s) => s.browser.contextSelectionMode,
  );
  const pendingScreenshots = useKartonState(
    (s) => s.browser.pendingElementScreenshots,
  );

  const elementSelectionActive = useMemo(() => {
    if (activeEditMessageId) return false;
    return selectionModeActive;
  }, [selectionModeActive, activeEditMessageId]);

  // Karton procedures
  const togglePanelKeyboardFocus = useKartonProcedure(
    (p) => p.browser.layout.togglePanelKeyboardFocus,
  );
  const sendUserMessage = useKartonProcedure(
    (p) => p.agentChat.sendUserMessage,
  );
  const stopAgent = useKartonProcedure((p) => p.agentChat.abortAgentCall);
  const setContextSelectionActive = useKartonProcedure(
    (p) => p.browser.contextSelection.setActive,
  );
  const clearSelectedElementsProc = useKartonProcedure(
    (p) => p.browser.contextSelection.clearElements,
  );
  const removeSelectedElementProc = useKartonProcedure(
    (p) => p.browser.contextSelection.removeElement,
  );
  const clearPendingScreenshotsProc = useKartonProcedure(
    (p) => p.browser.contextSelection.clearPendingScreenshots,
  );

  const isConnected = useKartonConnected();
  const reconnectState = useKartonReconnectState();

  const clearAll = useCallback(() => {
    clearFileAttachments();
    clearSelectedElementsProc();
    setLocalSelectedElements([]);
  }, [clearFileAttachments, clearSelectedElementsProc]);

  // Element selector helper functions
  const startContextSelector = useCallback(() => {
    setContextSelectionActive(true);
  }, [setContextSelectionActive]);

  const stopContextSelector = useCallback(() => {
    setContextSelectionActive(false);
  }, [setContextSelectionActive]);

  const abortAgent = useCallback(async () => {
    const result = await stopAgent();
    // If early abort conditions were met, restore the user message to the input
    if (!result.restored || !result.userMessage) return;

    const message = result.userMessage;

    // Restore text from message parts
    const textPart = message.parts.find((p) => p.type === 'text');
    const tiptapJsonContent = message.metadata?.tiptapJsonContent;
    if (tiptapJsonContent)
      chatInputRef.current?.setJsonContent(tiptapJsonContent);
    else if (textPart && textPart.type === 'text') setChatInput(textPart.text);
    else setChatInput('');

    // Restore file attachments from file parts
    const fileParts = message.parts.filter((p) => p.type === 'file');
    fileParts.forEach((part) => {
      if (!(part.type === 'file') || !part.url) return;
      const attachment = fileUIPartToFileAttachment(part);
      if (attachment) setFileAttachments((prev) => [...prev, attachment]);
    });

    // Restore selected elements from metadata
    const elements =
      (message.metadata?.selectedPreviewElements as SelectedElement[]) ?? [];
    if (elements.length > 0)
      setLocalSelectedElements((prev) => [...prev, ...elements]);

    // Restore tiptap JSON content (handles element badges in editor)
  }, [stopAgent]);

  const isVerboseMode = useKartonState(
    (s) => s.appInfo.releaseChannel === 'dev',
  );

  const enableInputField = useMemo(() => {
    // Only disable input if agent is not connected or reconnecting
    // Input is now always enabled when connected (allows typing while agent works)
    if (!isConnected || reconnectState.isReconnecting) return false;
    return true;
  }, [isConnected, reconnectState.isReconnecting]);

  const canSendMessage = useMemo(() => {
    // Allow sending when input is enabled and has enough text
    // (backend will queue if agent is working)
    return enableInputField && chatInput.trim().length > 2;
  }, [enableInputField, chatInput]);

  const hasOpenedInternalPage = useMemo(() => {
    return activeTab?.url?.startsWith('stagewise://internal/') ?? false;
  }, [activeTab?.url]);

  const handleSubmit = useCallback(async () => {
    if (!canSendMessage) return;

    const tiptapJsonContent = chatInputRef.current?.getTiptapJsonContent();

    // Collect metadata for selected elements and text clips
    const metadata = collectUserMessageMetadata(
      localSelectedElements,
      tiptapJsonContent,
    );

    // Include all file attachments (validation is handled by prompt builder)
    const message: ChatMessage = {
      id: generateId(),
      parts: [{ type: 'text' as const, text: chatInput }],
      role: 'user',
      metadata: {
        ...metadata,
        tiptapJsonContent,
        fileAttachments,
      },
    };

    // Reset state after sending
    setChatInput('');
    clearAll();
    stopContextSelector();

    // Clear the editor after sending
    chatInputRef.current?.clear();

    // Dispatch event to force scroll to bottom BEFORE sending (must happen before DOM updates)
    window.dispatchEvent(new Event('chat-message-sent'));

    // Send the message
    await sendUserMessage(message);

    // Keep input focused after sending - refocus in next tick
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 0);
  }, [
    canSendMessage,
    chatInput,
    fileAttachments,
    localSelectedElements,
    sendUserMessage,
    clearAll,
    stopContextSelector,
  ]);

  const contextUsed = useMemo(() => {
    const used = activeChat?.usage.usedContextWindowSize ?? 0;
    const max = activeChat?.usage.maxContextWindowSize ?? 1;
    return Math.min(100, Math.round((used / max) * 100));
  }, [
    activeChat?.usage.usedContextWindowSize,
    activeChat?.usage.maxContextWindowSize,
  ]);

  const [chatInputActive, setChatInputActive] = useState<boolean>(false);
  // Track if input was focused before app lost focus (for restoring on app regain)
  const wasActiveBeforeAppBlurRef = useRef(false);

  useEffect(() => {
    if (chatInputActive) {
      // Wait for the next tick to ensure the input is mounted
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 0);
    } else {
      // Don't automatically deactivate element selection here
      // Element selection can be controlled by other components (inline edit mode)
      // It will be deactivated explicitly when needed (Escape key, send message, agent working, panel closed)
      chatInputRef.current?.blur();
    }
  }, [chatInputActive]);

  const onInputFocus = useCallback(() => {
    // Cancel any active message edits when main chat input is focused
    window.dispatchEvent(new Event('cancel-all-message-edits'));
    if (!chatInputActive) setChatInputActive(true);
    // Clear the app blur flag since we're now focused
    wasActiveBeforeAppBlurRef.current = false;
  }, [chatInputActive]);

  const onInputBlur = useCallback(
    (ev: FocusEvent) => {
      const target = ev.relatedTarget as HTMLElement;
      // We should only allow chat blur if the user clicked outside the chat box or the context selector element tree. Otherwise, we should keep the input active by refocusing it.
      if (target?.closest('#chat-file-attachment-menu-content')) {
        return;
      }
      if (
        !target ||
        (!target.closest('#chat-input-container-box') &&
          !target.closest('#element-selector-element-canvas'))
      ) {
        // If relatedTarget is null, the app might be losing focus (e.g., CMD+tab)
        // Track this so we can restore focus when the app regains focus
        if (!target && chatInputActive)
          wasActiveBeforeAppBlurRef.current = true;

        setChatInputActive(false);
      } else if (chatInputActive) {
        chatInputRef.current?.focus();
      }
    },
    [chatInputActive],
  );

  // Restore focus when the app regains focus (e.g., after CMD+tab back)
  useEventListener(
    'focus',
    () => {
      if (!wasActiveBeforeAppBlurRef.current) return;
      wasActiveBeforeAppBlurRef.current = false;
      setChatInputActive(true);
      chatInputRef.current?.focus();
    },
    {},
    window,
  );

  // Clear focus restoration flag when omnibox takes focus (prevents chat from reclaiming focus)
  useEventListener('omnibox-focus-requested', () => {
    wasActiveBeforeAppBlurRef.current = false;
    setChatInputActive(false);
  });

  useHotKeyListener(
    useCallback(async () => {
      if (!chatInputActive) {
        // State 1: Sidebar is closed → open it and enable element selection
        window.dispatchEvent(new Event('sidebar-chat-panel-opened'));
        startContextSelector();
        await togglePanelKeyboardFocus('stagewise-ui');
      } else if (
        !elementSelectionActive &&
        !activeTab?.url?.startsWith('stagewise://internal/')
      ) {
        // State 2: Sidebar open, element selection OFF, *not* on the start page → activate element selection
        startContextSelector();
        // Ensure keyboard focus is on stagewise-ui so ESC key works
        await togglePanelKeyboardFocus('stagewise-ui');
      } else {
        // State 3: Sidebar open AND element selection ON → close sidebar
        window.dispatchEvent(new Event('sidebar-chat-panel-closed'));
        await togglePanelKeyboardFocus('tab-content');
      }
    }, [
      chatInputActive,
      elementSelectionActive,
      startContextSelector,
      togglePanelKeyboardFocus,
      activeTab?.url,
    ]),
    HotkeyActions.CTRL_I,
  );

  useEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (e.code === 'Escape' && chatInputActive) {
        if (elementSelectionActive) stopContextSelector();
        else setChatInputActive(false);
      }
    },
    {},
  );

  useEffect(() => {
    if (chatInputActive)
      window.dispatchEvent(new Event('sidebar-chat-panel-focused'));
  }, [chatInputActive]);

  useEventListener('sidebar-chat-panel-closed', () => {
    setChatInputActive(false);
    stopContextSelector();
  });

  useEventListener('sidebar-chat-panel-opened', () => {
    setChatInputActive(true);
    // Enable element selection (allowed even while agent is working for queued messages)
    startContextSelector();
  });

  const handleToggleElementSelection = useCallback(async () => {
    if (elementSelectionActive) stopContextSelector();
    else {
      setChatInputActive(true);
      startContextSelector();
      // Ensure keyboard focus is on stagewise-ui so ESC key works
      await togglePanelKeyboardFocus('stagewise-ui');
    }
  }, [
    elementSelectionActive,
    startContextSelector,
    stopContextSelector,
    togglePanelKeyboardFocus,
  ]);

  /**
   * Add a file attachment and insert a mention into the editor
   */
  const handleAddFileAttachment = useCallback(
    (file: File) => {
      addFileAttachment(file);
    },
    [addFileAttachment],
  );

  /**
   * Handle files pasted into the editor
   */
  const handlePasteFiles = useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        addFileAttachment(file);
      });
      chatInputRef.current?.focus();
    },
    [addFileAttachment],
  );

  /**
   * Handle attachment removal when badge is deleted from editor
   */
  const handleAttachmentRemoved = useCallback(
    (id: string, type: AttachmentType) => {
      if (type === 'image' || type === 'file') {
        removeFileAttachment(id);
      } else if (type === 'element') {
        removeSelectedElementProc(id);
        setLocalSelectedElements((prev) =>
          prev.filter((el) => el.stagewiseId !== id),
        );
      }
    },
    [removeFileAttachment, removeSelectedElementProc],
  );

  // Drag and drop via shared hook
  const { isDragOver, handlers: dragHandlers } = useDragDrop({
    onFileDrop: addFileAttachment,
    onDropComplete: () => chatInputRef.current?.focus(),
  });

  // Auto-add pending element screenshots as file attachments
  useEffect(() => {
    if (pendingScreenshots.length === 0) return;
    // We might auto-add pending element screenshots as file attachments in the future, it's disabled for now
    // Clear processed screenshots from state
    void clearPendingScreenshotsProc();
  }, [pendingScreenshots, clearPendingScreenshotsProc]);

  // Register main drop handler for forwarded events
  useEffect(() => {
    // Register the useDragDrop handler so forwarded events get the same processing
    setMainDropHandler(dragHandlers.onDrop);
  }, [setMainDropHandler, dragHandlers.onDrop]);

  // Watch for selected elements via shared hook
  useElementSelectionWatcher({
    isActive: elementSelectionActive,
    onNewElement: useCallback(
      (element: SelectedElement) => {
        setLocalSelectedElements((prev) => [...prev, element]);
        const attrs = selectedElementToAttachmentAttributes(element);
        chatInputRef.current?.insertAttachment(attrs);
      },
      [chatInputRef],
    ),
  });

  return (
    <footer className="z-20 flex shrink-0 flex-col items-stretch gap-1 px-1 pb-1">
      <div
        className={cn(
          'relative flex flex-row items-stretch gap-1 rounded-md bg-background p-2 shadow-elevation-1 ring-1 ring-derived-strong transition-colors dark:bg-surface-1',
          isDragOver && 'bg-hover-derived!',
        )}
        id="chat-input-container-box"
        data-chat-active={chatInputActive}
        onDragEnter={dragHandlers.onDragEnter}
        onDragLeave={dragHandlers.onDragLeave}
        onDragOver={dragHandlers.onDragOver}
        onDrop={dragHandlers.onDropBubble} // Reset drag state, let event bubble to ChatPanel
      >
        <ChatInput
          ref={chatInputRef}
          value={chatInput}
          onChange={setChatInput}
          onSubmit={handleSubmit}
          disabled={!enableInputField}
          attachmentCount={
            fileAttachments.length + localSelectedElements.length
          }
          showModelSelect
          onModelChange={() => chatInputRef.current?.focus()}
          showContextUsageRing={
            !!activeChat && (isVerboseMode || contextUsed > 80)
          }
          contextUsedPercentage={contextUsed}
          contextUsedKb={
            activeChat ? activeChat.usage.usedContextWindowSize / 1000 : 0
          }
          contextMaxKb={
            activeChat ? activeChat.usage.maxContextWindowSize / 1000 : 0
          }
          onFocus={onInputFocus}
          onBlur={onInputBlur}
          onPasteFiles={handlePasteFiles}
          onAttachmentRemoved={handleAttachmentRemoved}
        />
        <ChatInputActions
          isAgentWorking={isWorking}
          hasTextInput={chatInput.trim().length > 0}
          onStop={abortAgent}
          showElementSelectorButton
          elementSelectionActive={elementSelectionActive}
          onToggleElementSelection={handleToggleElementSelection}
          elementSelectorDisabled={hasOpenedInternalPage}
          showImageUploadButton
          onAddFileAttachment={handleAddFileAttachment}
          canSendMessage={canSendMessage}
          onSubmit={handleSubmit}
          isActive={chatInputActive}
        />
        <StatusCard />
      </div>
    </footer>
  );
}
