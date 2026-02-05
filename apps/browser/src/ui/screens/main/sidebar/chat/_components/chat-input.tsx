import { useEditor, EditorContent, type Content } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';
import { ModelSelect } from './model-select';
import { ContextUsageRing } from './context-usage-ring';
import { Button } from '@stagewise/stage-ui/components/button';
import { cn } from '@/utils';
import { HotkeyActions } from '@shared/hotkeys';
import {
  ArrowUpIcon,
  SquareIcon,
  SquareDashedMousePointerIcon,
  ImageUpIcon,
} from 'lucide-react';
import {
  useCallback,
  useMemo,
  useImperativeHandle,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { HotkeyComboText } from '@/components/hotkey-combo-text';
import { usePostHog } from 'posthog-js/react';
import {
  configureAttachmentExtensions,
  type AttachmentAttributes,
  type AttachmentType,
} from './rich-text';
import { useState } from 'react';
// Re-export types for convenience
export type { AttachmentAttributes, AttachmentType };

export interface ChatInputProps {
  // Core controlled input
  value?: Content; // TipTap JSON content string
  defaultValue?: Content; // TipTap JSON content string
  onChange?: (TipTapContent: Content) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;

  // Attachment count for display
  attachmentCount?: number;

  // Model selector
  showModelSelect?: boolean;
  onModelChange?: () => void;

  // Context usage ring
  showContextUsageRing?: boolean;
  contextUsedPercentage?: number;
  contextUsedKb?: number;
  contextMaxKb?: number;

  // Queued messages (for early flushing)
  hasQueuedMessages?: boolean;
  onFlushQueue?: () => void;

  // Focus management
  onFocus?: () => void;
  onBlur?: (event: FocusEvent) => void;
  onEscape?: () => void;

  // File paste handling
  onPasteFiles?: (files: File[]) => void;

  // Attachment removal callback (when badges are deleted from editor)
  onAttachmentRemoved?: (id: string, type: AttachmentType) => void;

  // Styling
  className?: string;

  ref: React.RefObject<ChatInputHandle>;
}

export interface ChatInputHandle {
  focus: () => void;
  blur: () => void;
  /** Insert an attachment mention at the current cursor position */
  insertAttachment: (attrs: AttachmentAttributes) => void;
  getTextContent: () => string;
}

export const ChatInput = ({
  value,
  defaultValue,
  onChange,
  onSubmit,
  disabled = false,
  placeholder,
  attachmentCount: _attachmentCount = 0,

  showModelSelect = true,
  onModelChange,

  showContextUsageRing = false,
  contextUsedPercentage = 0,
  contextUsedKb = 0,
  contextMaxKb = 0,

  hasQueuedMessages = false,
  onFlushQueue,

  onFocus,
  onBlur,
  onEscape,
  onPasteFiles,
  onAttachmentRemoved,

  className,
  ref,
}: ChatInputProps) => {
  const focusChatHotkeyText = HotkeyComboText({
    action: HotkeyActions.TOGGLE_CONTEXT_SELECTOR,
  });

  const shownPlaceholder = useRef('');
  useEffect(() => {
    shownPlaceholder.current =
      placeholder ??
      `Ask anything about this page ${focusChatHotkeyText}${hasQueuedMessages ? ', or press ↵ to send now' : ''}`;
  }, [placeholder, focusChatHotkeyText, hasQueuedMessages]);
  const staticPlaceholderRef = useRef(() => shownPlaceholder.current);

  const [textContent, setTextContent] = useState<string>('');

  // Track if the last change was from the editor (internal) vs from props (external)
  // This prevents the value effect from overwriting user edits
  const isInternalChangeRef = useRef(false);

  const [internalValue, setInternalValue] = useState<Content | null>(
    value ?? defaultValue ?? { type: 'doc', content: [{ type: 'paragraph' }] },
  );
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value);
    }
  }, [value]);

  // TipTap editor setup
  const editor = useEditor({
    // Disable standard markdown parsing - treat **bold**, *italic*, etc. as literal characters
    // but keep our custom attachment link parsing via Markdown extension
    enableInputRules: false,
    enablePasteRules: false,
    extensions: [
      StarterKit.configure({
        // Disable block-level features we don't need for chat input
        heading: false,
        dropcursor: false,
        bulletList: false,
        orderedList: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        // Keep paragraph for line breaks
        paragraph: {
          HTMLAttributes: {
            class: 'min-h-[1.5em]',
          },
        },
      }),
      Placeholder.configure({
        placeholder: staticPlaceholderRef.current,
      }),
      ...configureAttachmentExtensions({
        onNodeDeleted: onAttachmentRemoved,
      }),
      // Add Markdown extension for parsing/serializing attachment links
      Markdown,
    ],
    content: internalValue,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          'h-full w-full resize-none text-foreground text-sm outline-none',
          'prose prose-sm max-w-none',
          // Style paragraphs to not have extra margins
          '[&_p]:m-0 [&_p]:leading-relaxed',
        ),
      },
      handleKeyDown: (view, event) => {
        // Handle Enter without Shift for submit
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          // If input is empty and there are queued messages, flush the queue
          const isEmpty = view.state.doc.textContent.trim().length === 0;
          if (isEmpty && hasQueuedMessages && onFlushQueue) {
            onFlushQueue();
          } else {
            handleSubmit();
          }
          return true;
        }
        // Handle Escape
        if (event.key === 'Escape') {
          event.preventDefault();
          onEscape?.();
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items || !onPasteFiles) return false;

        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item?.kind === 'file') {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }

        if (files.length > 0) {
          event.preventDefault();
          onPasteFiles(files);
          return true;
        }

        return false;
      },
      // Prevent TipTap from handling drops - let parent elements handle via useDragDrop
      handleDrop: () => true,
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON();
      setTextContent(ed.getText());
      // Mark this as an internal change so the value effect doesn't interfere
      isInternalChangeRef.current = true;
      onChange?.(json);
    },

    onFocus: () => {
      onFocus?.();
    },
    onBlur: ({ event }) => {
      onBlur?.(event);
    },
  });

  useEffect(() => {
    editor?.commands.selectAll();
  }, [editor, shownPlaceholder]);

  const canSendMessage = useMemo(() => {
    return !disabled && textContent.trim().length > 2;
  }, [disabled, textContent]);

  const handleSubmit = useCallback(() => {
    if (canSendMessage) {
      onSubmit();
    }
  }, [canSendMessage, onSubmit]);

  // Update editable state when disabled changes
  // CRITICAL: Use useLayoutEffect to sync editor state BEFORE paint
  // This prevents visual flicker when transitioning between edit/view modes
  useLayoutEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  // Sync external value changes to editor - but ONLY for explicit resets (empty doc)
  // We don't sync every value change because that causes feedback loops and race conditions
  // The editor manages its own state; we only need to reset it when explicitly cleared
  useEffect(() => {
    // Skip if this is an internal change (from user editing or insertAttachment)
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    if (!editor || value === undefined) return;

    // Check if this is an explicit reset to empty document
    // This handles the case after sending a message when parent clears the input
    const valueContent = (value as { content?: unknown[] })?.content;
    const isEmptyDoc =
      valueContent?.length === 1 &&
      (valueContent[0] as { type?: string })?.type === 'paragraph' &&
      !(valueContent[0] as { content?: unknown[] })?.content;

    const currentDocSize = editor.state.doc.content.size;
    const isCurrentlyEmpty = currentDocSize <= 2; // Empty doc has size 2

    // Only reset if: value is empty AND editor is not already empty
    // This prevents resetting during normal editing
    if (isEmptyDoc && !isCurrentlyEmpty) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  // NOTE: Previously had a MutationObserver here to fix cursor positioning around
  // inline attachment badges by injecting zero-width spaces. However, this approach
  // was fundamentally flawed because it modified the DOM directly without going
  // through ProseMirror's transaction system, causing:
  // 1. Document model desync (ProseMirror's model didn't match actual DOM)
  // 2. "Position X out of range" errors on click/selection
  // 3. Content loss when serializing (getJSON/getText read from corrupted model)
  //
  // The cursor positioning is now handled via CSS pseudo-elements (see EditorContent className)
  // which provides visual spacing without corrupting ProseMirror's state.

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      editor?.commands.focus('end');
    },
    blur: () => {
      editor?.commands.blur();
    },
    insertAttachment: (attrs: AttachmentAttributes) => {
      if (editor) {
        // Mark as internal change so valueEffect doesn't reset content
        isInternalChangeRef.current = true;
        editor.commands.insertAttachment(attrs);
      }
    },
    getTextContent: () => {
      if (!editor) return '';
      return editor.getText();
    },
    clear: () => {
      editor?.commands.clearContent();
    },
  }));

  return (
    <div className={cn('flex flex-1 flex-col items-stretch gap-1', className)}>
      {/* Rich text input area */}
      <div
        className={cn(
          'relative h-full w-full',
          // Only add padding when editable (not in view mode)
          !disabled && 'pr-1',
        )}
      >
        <EditorContent
          editor={editor}
          className={cn(
            'h-full w-full',
            // Editable mode: scrollbar and max-height constraints
            !disabled && 'scrollbar-subtle max-h-64 overflow-y-auto',
            // View mode: no overflow/scroll styling, natural content flow
            disabled && 'overflow-visible',
            // Placeholder styling (from @tiptap/extension-placeholder) - only for editable
            !disabled &&
              '[&_.tiptap_p.is-editor-empty:first-child]:before:pointer-events-none',
            !disabled &&
              '[&_.tiptap_p.is-editor-empty:first-child]:before:float-left',
            !disabled && '[&_.tiptap_p.is-editor-empty:first-child]:before:h-0',
            !disabled &&
              '[&_.tiptap_p.is-editor-empty:first-child]:before:text-subtle-foreground',
            !disabled &&
              '[&_.tiptap_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
            // Breathing room around the inline attachment nodes (all types)
            '[&_.react-renderer.node-fileAttachment]:before:content-[""] [&_.react-renderer.node-fileAttachment]:after:content-[""]',
            '[&_.react-renderer.node-fileAttachment]:before:inline-block [&_.react-renderer.node-fileAttachment]:after:inline-block',
            '[&_.react-renderer.node-fileAttachment]:before:w-0.5 [&_.react-renderer.node-fileAttachment]:after:w-0.5',
            '[&_.react-renderer.node-imageAttachment]:before:content-[""] [&_.react-renderer.node-imageAttachment]:after:content-[""]',
            '[&_.react-renderer.node-imageAttachment]:before:inline-block [&_.react-renderer.node-imageAttachment]:after:inline-block',
            '[&_.react-renderer.node-imageAttachment]:before:w-0.5 [&_.react-renderer.node-imageAttachment]:after:w-0.5',
            '[&_.react-renderer.node-elementAttachment]:before:content-[""] [&_.react-renderer.node-elementAttachment]:after:content-[""]',
            '[&_.react-renderer.node-elementAttachment]:before:inline-block [&_.react-renderer.node-elementAttachment]:after:inline-block',
            '[&_.react-renderer.node-elementAttachment]:before:w-0.5 [&_.react-renderer.node-elementAttachment]:after:w-0.5',
            '[&_.react-renderer.node-textClipAttachment]:before:content-[""] [&_.react-renderer.node-textClipAttachment]:after:content-[""]',
            '[&_.react-renderer.node-textClipAttachment]:before:inline-block [&_.react-renderer.node-textClipAttachment]:after:inline-block',
            '[&_.react-renderer.node-textClipAttachment]:before:w-0.5 [&_.react-renderer.node-textClipAttachment]:after:w-0.5',
          )}
        />
      </div>

      {/* Controls area - only shown when not disabled and has content to show */}
      {!disabled &&
        (showModelSelect ||
          (showContextUsageRing && contextUsedPercentage > 0)) && (
          <div className="flex shrink-0 flex-row flex-wrap items-center justify-start gap-1 *:shrink-0">
            {showModelSelect && (
              <ModelSelect
                onModelChange={() => {
                  // Defer focus until after popover closes using double rAF
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      editor?.commands.focus('end');
                      onModelChange?.();
                    });
                  });
                }}
              />
            )}
            {showContextUsageRing && contextUsedPercentage > 0 && (
              <ContextUsageRing
                percentage={contextUsedPercentage}
                usedKb={contextUsedKb}
                maxKb={contextMaxKb}
              />
            )}
          </div>
        )}
    </div>
  );
};

export interface ChatInputActionsProps {
  /** Whether the agent is currently working (used to determine stop/send button visibility) */
  isAgentWorking?: boolean;
  /** Whether the input has text (used to switch between stop and send button when agent is working) */
  hasTextInput?: boolean;
  onStop?: () => void;

  showElementSelectorButton?: boolean;
  elementSelectionActive?: boolean;
  onToggleElementSelection?: () => void;
  elementSelectorDisabled?: boolean;

  showImageUploadButton?: boolean;
  onAddFileAttachment?: (file: File) => void;

  canSendMessage: boolean;
  onSubmit: () => void;
  isActive?: boolean;
}

export function ChatInputActions({
  isAgentWorking = false,
  hasTextInput = false,
  onStop,

  showElementSelectorButton = true,
  elementSelectionActive = false,
  onToggleElementSelection,
  elementSelectorDisabled = false,

  showImageUploadButton = true,
  onAddFileAttachment,

  canSendMessage,
  onSubmit,
  isActive = true,
}: ChatInputActionsProps) {
  const posthog = usePostHog();

  // Derive button visibility from agent state and input text
  // Show stop button when: agent is working AND no text input
  // Show send button when: agent is not working OR has text input
  const showStopButton = isAgentWorking && !hasTextInput && !!onStop;
  const showSendButton = !isAgentWorking || hasTextInput;

  return (
    <div className="flex shrink-0 flex-col items-center justify-end gap-1">
      {/* Element selector and image upload - always shown (can add context to queued messages) */}
      {showElementSelectorButton && (
        <Tooltip>
          <TooltipTrigger>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={elementSelectorDisabled}
              className="shrink-0 data-[element-selector-active=true]:bg-primary-foreground/5 data-[element-selector-active=true]:text-primary-foreground"
              data-element-selector-active={elementSelectionActive}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleElementSelection?.();
              }}
              aria-label="Select context elements"
            >
              <SquareDashedMousePointerIcon className="size-3.5 stroke-[2.5px]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {elementSelectionActive ? (
              'Stop selecting elements (Esc)'
            ) : (
              <>
                Add reference elements (
                <HotkeyComboText
                  action={HotkeyActions.TOGGLE_CONTEXT_SELECTOR}
                />
                )
              </>
            )}
          </TooltipContent>
        </Tooltip>
      )}
      {showImageUploadButton && onAddFileAttachment && (
        <>
          <input
            type="file"
            multiple
            className="hidden"
            accept="image/png, image/jpeg, image/gif, image/webp, application/pdf, text/plain"
            id="chat-file-attachment-input-file"
          />
          <Tooltip>
            <TooltipTrigger>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Upload image"
                className="mb-1 shrink-0"
                onClick={() => {
                  const input = document.getElementById(
                    'chat-file-attachment-input-file',
                  ) as HTMLInputElement;
                  input.value = '';
                  input.click();
                  input.onchange = (e) => {
                    Array.from(
                      (e.target as HTMLInputElement).files ?? [],
                    ).forEach((file) => {
                      onAddFileAttachment(file);
                      posthog.capture('agent_file_uploaded', {
                        file_type: file.type,
                        method: 'chat_file_attachment_menu',
                      });
                    });
                  };
                }}
              >
                <ImageUpIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Upload image</TooltipContent>
          </Tooltip>
        </>
      )}
      {showStopButton && (
        <Tooltip>
          <TooltipTrigger>
            <Button
              onClick={onStop}
              aria-label="Stop agent"
              variant="secondary"
              className="group z-10 size-8 shrink-0 cursor-pointer rounded-full p-1 opacity-100! shadow-md backdrop-blur-lg !disabled:*:opacity-10"
            >
              <SquareIcon className="size-3.5 fill-current" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop agent</TooltipContent>
        </Tooltip>
      )}
      {/* Send button - show when agent is not working OR has text input */}
      {showSendButton && (
        <Tooltip>
          <TooltipTrigger>
            <Button
              disabled={!canSendMessage}
              onClick={onSubmit}
              aria-label="Send message"
              variant={isActive ? 'primary' : 'secondary'}
              className="z-10 size-8 shrink-0 cursor-pointer rounded-full p-1 shadow-md backdrop-blur-lg transition-all"
            >
              <ArrowUpIcon className="size-4 stroke-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Send message</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
