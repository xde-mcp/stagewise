import posthog from 'posthog-js';
import { StatusCard } from './footer-status-card';
import type { SelectedElement } from '@shared/selected-elements';
import { useMessageEditState } from '@/hooks/use-message-edit-state';
import { useFileAttachments } from '@/hooks/use-file-attachments';
import { useDragDrop } from '@/hooks/use-drag-drop';
import { useElementSelectionWatcher } from '@/hooks/use-element-selection-watcher';
import { cn, generateId, collectUserMessageMetadata } from '@/utils';
import { HotkeyActions } from '@shared/hotkeys';
import {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
  type RefObject,
} from 'react';
import {
  useKartonState,
  useKartonProcedure,
  useKartonConnected,
  useKartonReconnectState,
} from '@/hooks/use-karton';
import { useHotKeyListener } from '@/hooks/use-hotkey-listener';
import { useEventListener } from '@/hooks/use-event-listener';
import {
  ChatInput,
  ChatInputActions,
  type ChatInputHandle,
} from './chat-input';
import type { AttachmentType } from '@/screens/main/sidebar/chat/_components/rich-text';
import { selectedElementToAttachmentAttributes } from '@/utils/attachment-conversions';
import type { AgentMessage } from '@shared/karton-contracts/ui/agent';
import { useOpenAgent } from '@/hooks/use-open-chat';
import { useChatDraft } from '@/hooks/use-chat-draft';
import type { Content } from '@tiptap/core';
import {
  markdownToTipTapContent,
  enrichTipTapContent,
} from '@/utils/tiptap-content-utils';

export function ChatPanelFooter() {
  const chatInputRef = useRef<ChatInputHandle>(null);
  const { registerDraftGetter } = useChatDraft();

  // Register the draft getter so other components can access the current input
  useEffect(() => {
    const unregister = registerDraftGetter(() => {
      return chatInputRef.current?.getJsonContent() ?? '';
    });
    return unregister;
  }, [registerDraftGetter]);

  const [openAgent] = useOpenAgent();

  const isWorking = useKartonState((s) =>
    openAgent ? s.agents.instances[openAgent]?.state.isWorking || false : false,
  );

  const history = useKartonState((s) =>
    openAgent ? s.agents.instances[openAgent]?.state.history : [],
  );
  const historyRef = useRef(history);
  historyRef.current = history;

  const chatInputState = useKartonState((s) =>
    openAgent ? s.agents.instances[openAgent]?.state.inputState : null,
  );
  const setChatInputState = useKartonProcedure(
    (p) => p.agents.updateInputState,
  );

  const [localInputState, setLocalInputState] = useState<Content | null>(() =>
    chatInputState && chatInputState.length > 0
      ? JSON.parse(chatInputState)
      : null,
  );

  const updateChatInputState = useCallback(
    (newInputState: Content) => {
      setLocalInputState(newInputState);
      if (openAgent) {
        void setChatInputState(openAgent, JSON.stringify(newInputState));
      }
    },
    [openAgent, setChatInputState],
  );

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
  } = useFileAttachments({
    chatInputRef: chatInputRef as RefObject<ChatInputHandle>,
  });

  const { activeEditMessageId, setMainDropHandler } = useMessageEditState();

  // Restore draft when activeChat changes (after switch or create)
  useEffect(() => {
    setLocalSelectedElements([]);
  }, [openAgent]);

  // Focus input when agent changes (e.g., new chat created or switched)
  // This is needed because ChatInput has key={openAgent}, so it re-mounts
  // and loses focus when the agent changes
  useEffect(() => {
    // Use requestAnimationFrame to ensure the ChatInput is mounted
    if (openAgent)
      requestAnimationFrame(() => {
        chatInputRef.current?.focus();
      });
  }, [openAgent]);

  const activeTabId = useKartonState((s) => s.browser.activeTabId);
  const tabs = useKartonState((s) => s.browser.tabs);
  const activeTab = useMemo(() => {
    return activeTabId ? tabs[activeTabId] : null;
  }, [tabs, activeTabId]);

  // Element selection state from Karton
  const selectionModeActive = useKartonState(
    (s) => s.browser.contextSelectionMode,
  );

  const elementSelectionActive = useMemo(() => {
    if (activeEditMessageId) return false;
    return selectionModeActive;
  }, [selectionModeActive, activeEditMessageId]);

  // Karton procedures
  const togglePanelKeyboardFocus = useKartonProcedure(
    (p) => p.browser.layout.togglePanelKeyboardFocus,
  );
  const sendUserMessage = useKartonProcedure((p) => p.agents.sendUserMessage);
  const stopAgent = useKartonProcedure((p) => p.agents.stop);
  const revertToUserMessage = useKartonProcedure(
    (p) => p.agents.revertToUserMessage,
  );
  const setContextSelectionActive = useKartonProcedure(
    (p) => p.browser.contextSelection.setActive,
  );
  const clearSelectedElementsProc = useKartonProcedure(
    (p) => p.browser.contextSelection.clearElements,
  );
  const removeSelectedElementProc = useKartonProcedure(
    (p) => p.browser.contextSelection.removeElement,
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

  // Pending early-abort revert: deferred until isWorking becomes false
  // so the stream is fully done and won't re-add the assistant message.
  const [pendingRevert, setPendingRevert] = useState<{
    messageId: string;
    message: AgentMessage;
  } | null>(null);

  useEffect(() => {
    if (!isWorking && pendingRevert) {
      const { messageId, message } = pendingRevert;
      setPendingRevert(null);

      // Revert chat history (remove user msg + partial response)
      if (openAgent) revertToUserMessage(openAgent, messageId, false);

      // Restore input content: parse markdown then inject full attachment
      // data from metadata so nodes are identical to fresh composition
      const textPart = message.parts.find((p) => p.type === 'text');
      const text = textPart?.type === 'text' ? textPart.text : '';
      if (text) {
        const parsed = markdownToTipTapContent(text);
        const tiptapContent = enrichTipTapContent(parsed, {
          fileAttachments: message.metadata?.fileAttachments,
          textClipAttachments: message.metadata?.textClipAttachments,
          selectedPreviewElements: message.metadata?.selectedPreviewElements as
            | SelectedElement[]
            | undefined,
        });
        updateChatInputState(tiptapContent);
      }

      // Restore file attachments state (used by handleSubmit for the message)
      if (message.metadata?.fileAttachments?.length) {
        setFileAttachments(message.metadata.fileAttachments);
      }

      // Restore selected elements state
      const elements = message.metadata?.selectedPreviewElements;
      if (elements?.length) {
        setLocalSelectedElements(elements as SelectedElement[]);
      }
    }
  }, [
    isWorking,
    pendingRevert,
    revertToUserMessage,
    openAgent,
    updateChatInputState,
    setFileAttachments,
  ]);

  const abortAgent = useCallback(async () => {
    // Snapshot history before stop
    const currentHistory = historyRef.current ?? [];

    // Find last user message
    let lastUserMsgIndex = -1;
    for (let i = currentHistory.length - 1; i >= 0; i--) {
      if (currentHistory[i].role === 'user') {
        lastUserMsgIndex = i;
        break;
      }
    }

    // Check early abort condition before stopping: no tool calls AND text < 200 chars
    if (lastUserMsgIndex !== -1) {
      const assistantParts = currentHistory
        .slice(lastUserMsgIndex + 1)
        .flatMap((m) => m.parts);

      const hasToolCall = assistantParts.some(
        (p) => p.type.startsWith('tool-') || p.type === 'dynamic-tool',
      );
      const textLength = assistantParts
        .filter((p) => p.type === 'text')
        .reduce((sum, p) => sum + (p.type === 'text' ? p.text.length : 0), 0);

      if (!hasToolCall && textLength < 200) {
        const userMessage = currentHistory[lastUserMsgIndex];

        // Schedule revert for when the stream is fully done (isWorking → false)
        setPendingRevert({ messageId: userMessage.id, message: userMessage });
      }
    }

    // Stop the agent (revert will fire once isWorking becomes false)
    if (openAgent) await stopAgent(openAgent);
  }, [stopAgent, openAgent]);

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
    return (
      enableInputField &&
      (chatInputRef.current?.getTextContent()?.trim().length ?? 0) > 2
    );
  }, [enableInputField, localInputState]);

  const hasOpenedInternalPage = useMemo(() => {
    return activeTab?.url?.startsWith('stagewise://internal/') ?? false;
  }, [activeTab?.url]);

  const handleSubmit = useCallback(async () => {
    if (!canSendMessage) return;

    // Collect metadata for selected elements and text clips
    const metadata = collectUserMessageMetadata(
      localSelectedElements,
      localInputState,
    );

    const markdownText = chatInputRef.current!.getTextContent();

    // Include all file attachments (validation is handled by prompt builder)
    // Note: We no longer store tipTapContent - the text part contains markdown
    // with attachment links (e.g., [](image:abc123)) generated by editor.getText()
    const message: AgentMessage & { role: 'user' } = {
      id: generateId(),
      parts: [{ type: 'text' as const, text: markdownText }],
      role: 'user',
      metadata: {
        ...metadata,
        fileAttachments,
      },
    };

    // Save for restore on error
    const previousContent = localInputState;

    clearAll();
    stopContextSelector();

    // Clear input IMMEDIATELY (before network call)
    chatInputRef.current?.clear();
    const emptyDoc: Content = {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    };
    setLocalInputState(emptyDoc);
    if (openAgent) void setChatInputState(openAgent, JSON.stringify(emptyDoc));

    // Dispatch event with message data for optimistic rendering
    // ChatHistory will render this message IMMEDIATELY before server confirms
    window.dispatchEvent(
      new CustomEvent('chat-message-sent', { detail: { message } }),
    );

    try {
      // Send the message to server (optimistic message is already visible)
      if (openAgent) await sendUserMessage(openAgent, message);

      // Keep input focused after sending - refocus in next tick
      setTimeout(() => {
        chatInputRef.current?.focus();
      }, 0);
    } catch (error) {
      // Restore input on failure
      setLocalInputState(previousContent);
      // Remove the optimistic message on failure
      window.dispatchEvent(
        new CustomEvent('chat-message-failed', {
          detail: { clientId: message.id },
        }),
      );
      console.error('Failed to send message:', error);
      posthog.captureException(
        error instanceof Error ? error : new Error(String(error)),
        { source: 'renderer', operation: 'sendChatMessage' },
      );
    }
  }, [
    localInputState,
    canSendMessage,
    fileAttachments,
    localSelectedElements,
    sendUserMessage,
    openAgent,
    setChatInputState,
    clearAll,
    stopContextSelector,
  ]);

  const usedTokens = useKartonState((s) =>
    openAgent ? s.agents.instances[openAgent]?.state.usedTokens : 0,
  );
  const maxTokens = 200000; // TODO Add max tokens info to agent state

  const contextUsed = useMemo(() => {
    const used = usedTokens ?? 0;
    const max = maxTokens ?? 1;
    return Math.min(100, Math.round((used / max) * 100));
  }, [usedTokens, maxTokens]);

  const queuedMessages = useKartonState((s) =>
    openAgent ? s.agents.instances[openAgent]?.state.queuedMessages : [],
  );
  const flushQueue = useKartonProcedure((p) => p.agents.flushQueue);
  const handleFlushQueue = useCallback(() => {
    if (openAgent) void flushQueue(openAgent);
  }, [flushQueue, openAgent]);

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
    // Also stop context selection to prevent its ESC handler from consuming the first ESC
    stopContextSelector();
  });

  // Clear focus restoration flag when search bar takes focus (prevents chat from reclaiming focus)
  useEventListener('search-bar-focus-requested', () => {
    wasActiveBeforeAppBlurRef.current = false;
    setChatInputActive(false);
    // Also stop context selection to prevent its ESC handler from consuming the first ESC
    stopContextSelector();
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
    HotkeyActions.TOGGLE_CONTEXT_SELECTOR,
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
      if (type === 'image' || type === 'file') removeFileAttachment(id);
      else if (type === 'element') {
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

  const allowUserInput = useKartonState((s) =>
    openAgent ? s.agents.instances[openAgent]?.allowUserInput : false,
  );
  if (!allowUserInput) return null;

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
          key={openAgent}
          ref={chatInputRef as RefObject<ChatInputHandle>}
          value={localInputState}
          onChange={updateChatInputState}
          onSubmit={handleSubmit}
          disabled={!enableInputField}
          attachmentCount={
            fileAttachments.length + localSelectedElements.length
          }
          showModelSelect
          onModelChange={() => chatInputRef.current?.focus()}
          showContextUsageRing={
            !!usedTokens && (isVerboseMode || contextUsed > 80)
          }
          contextUsedPercentage={contextUsed}
          contextUsedKb={usedTokens ? usedTokens / 1000 : 0}
          contextMaxKb={maxTokens ? maxTokens / 1000 : 0}
          hasQueuedMessages={(queuedMessages?.length ?? 0) > 0}
          onFlushQueue={handleFlushQueue}
          onFocus={onInputFocus}
          onBlur={onInputBlur}
          onPasteFiles={handlePasteFiles}
          onAttachmentRemoved={handleAttachmentRemoved}
        />
        <ChatInputActions
          isAgentWorking={isWorking}
          hasTextInput={
            (chatInputRef.current?.getTextContent()?.trim().length ?? 0) > 0
          }
          onStop={abortAgent}
          showElementSelectorButton
          elementSelectionActive={elementSelectionActive}
          onToggleElementSelection={handleToggleElementSelection}
          elementSelectorDisabled={hasOpenedInternalPage}
          showImageUploadButton
          onAddFileAttachment={handleAddFileAttachment}
          canSendMessage={canSendMessage ?? false}
          onSubmit={handleSubmit}
          isActive={chatInputActive}
        />
        <StatusCard />
      </div>
    </footer>
  );
}
