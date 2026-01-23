import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
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
  useRef,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useLayoutEffect,
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
  ALL_ATTACHMENT_NODE_NAMES,
  type AttachmentAttributes,
  type AttachmentType,
} from './rich-text';

// Re-export types for convenience
export type { AttachmentAttributes, AttachmentType };

export interface ChatInputProps {
  // Core controlled input
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;

  // Initial JSON content (takes precedence over value for initialization)
  initialJsonContent?: string;

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
}

export interface ChatInputHandle {
  focus: () => void;
  blur: () => void;
  /** Insert an attachment mention at the current cursor position */
  insertAttachment: (attrs: AttachmentAttributes) => void;
  /** Get the plain text content with @attachments */
  getTextContent: () => string;
  /** Clear the editor content */
  clear: () => void;
  /** Set content from TipTap JSON string */
  setJsonContent: (json: string) => void;
  /** Get the tiptap JSON content */
  getTiptapJsonContent: () => string;
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput(
    {
      value,
      onChange,
      onSubmit,
      disabled = false,
      placeholder,
      initialJsonContent,

      attachmentCount: _attachmentCount = 0,

      showModelSelect = true,
      onModelChange,

      showContextUsageRing = false,
      contextUsedPercentage = 0,
      contextUsedKb = 0,
      contextMaxKb = 0,

      onFocus,
      onBlur,
      onEscape,
      onPasteFiles,
      onAttachmentRemoved,

      className,
    },
    ref,
  ) {
    const focusChatHotkeyText = HotkeyComboText({
      action: HotkeyActions.CTRL_I,
    });

    const resolvedPlaceholder =
      placeholder ?? `Ask anything about this page ${focusChatHotkeyText}`;

    const canSendMessage = useMemo(() => {
      return !disabled && value.trim().length > 2;
    }, [disabled, value]);

    const handleSubmit = useCallback(() => {
      if (canSendMessage) {
        onSubmit();
      }
    }, [canSendMessage, onSubmit]);

    // Track last value for external sync
    const lastValueRef = useRef(value);

    // Parse initial JSON content if provided, fallback to plain text
    const getInitialContent = useCallback(() => {
      if (initialJsonContent) {
        try {
          return JSON.parse(initialJsonContent);
        } catch {
          console.warn(
            'Failed to parse initialJsonContent, falling back to plain text',
          );
        }
      }
      return value ? `<p>${value}</p>` : '';
    }, [initialJsonContent, value]);

    // TipTap editor setup
    const editor = useEditor({
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
          placeholder: resolvedPlaceholder,
        }),
        ...configureAttachmentExtensions({
          onNodeDeleted: onAttachmentRemoved,
        }),
      ],
      content: getInitialContent(),
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
        handleKeyDown: (_view, event) => {
          // Handle Enter without Shift for submit
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
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
        // Extract plain text with @attachments preserved
        const text = extractTextWithMentions(ed);
        lastValueRef.current = text;
        onChange(text);
      },
      onFocus: () => {
        onFocus?.();
      },
      onBlur: ({ event }) => {
        onBlur?.(event);
      },
    });

    // Update editable state when disabled changes
    // CRITICAL: Use useLayoutEffect to sync editor state BEFORE paint
    // This prevents visual flicker when transitioning between edit/view modes
    useLayoutEffect(() => {
      if (editor) editor.setEditable(!disabled);
    }, [editor, disabled]);

    // Update content when initialJsonContent changes (for MessageUser view mode)
    // This is needed because useEditor only uses content during initial creation
    useEffect(() => {
      if (!editor || !initialJsonContent) return;

      // Only update if the editor is empty or has different content
      const currentContent = JSON.stringify(editor.getJSON());
      if (currentContent !== initialJsonContent) {
        try {
          editor.commands.setContent(JSON.parse(initialJsonContent));
        } catch {
          console.warn('Failed to update editor with initialJsonContent');
        }
      }
    }, [editor, initialJsonContent]);

    // Sync external value changes to editor (for restoration after abort, etc.)
    // NOTE: Skip when disabled (view mode) to avoid overwriting JSON content
    useEffect(() => {
      // Skip when disabled - in view mode, content is managed by initialJsonContent
      if (disabled) {
        lastValueRef.current = value;
        return;
      }
      // Only update if the value changed externally (not from editor onChange)
      // and the editor exists
      const editorText = editor ? extractTextWithMentions(editor) : undefined;
      if (
        editorText !== undefined &&
        value !== lastValueRef.current &&
        value !== editorText
      ) {
        // Convert plain text to HTML, preserving newlines
        const html = value
          .split('\n')
          .map((line) => `<p>${line || '<br>'}</p>`)
          .join('');
        editor?.commands.setContent(html);
      }
      lastValueRef.current = value;
    }, [value, disabled, editor]);

    // Fix cursor positioning around inline attachment badges
    // The browser's Selection API returns a zero rect when cursor is at element boundaries
    // rather than inside a text node. We inject zero-width spaces to ensure proper cursor rendering.
    useEffect(() => {
      // Use the specific editor instance's DOM element instead of querySelector
      // This ensures each editor has its own observer watching the correct element
      const editorElement = editor?.view?.dom;
      if (!editorElement) return;

      // Build selector for all attachment node types
      const attachmentSelectors = ALL_ATTACHMENT_NODE_NAMES.map(
        (name) => `.react-renderer.node-${name}`,
      ).join(', ');

      const observer = new MutationObserver(() => {
        editorElement
          .querySelectorAll(attachmentSelectors)
          .forEach((renderer) => {
            // Fix BEFORE badge: ensure text node exists
            const prev = renderer.previousSibling;
            if (!prev || prev.nodeType !== 3) {
              const textNode = document.createTextNode('\u200B');
              renderer.parentNode?.insertBefore(textNode, renderer);
            }

            // Fix AFTER badge: ensure text node exists before separator or next badge
            const next = renderer.nextSibling;
            if (next && next.nodeType !== 3) {
              // Check if next element is a ProseMirror separator or another attachment node
              const isProblematic =
                (next.nodeName === 'IMG' &&
                  (next as Element).classList?.contains(
                    'ProseMirror-separator',
                  )) ||
                ALL_ATTACHMENT_NODE_NAMES.some((name) =>
                  (next as Element).classList?.contains(`node-${name}`),
                );
              if (isProblematic) {
                const textNode = document.createTextNode('\u200B');
                renderer.parentNode?.insertBefore(textNode, next);
              }
            }
          });
      });

      observer.observe(editorElement, {
        childList: true,
        subtree: true,
      });

      return () => observer.disconnect();
    }, [editor]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        editor?.commands.focus('end');
      },
      blur: () => {
        editor?.commands.blur();
      },
      insertAttachment: (attrs: AttachmentAttributes) => {
        if (editor) editor.commands.insertAttachment(attrs);
      },
      getTextContent: () => {
        if (!editor) return '';
        return extractTextWithMentions(editor);
      },
      clear: () => {
        editor?.commands.clearContent();
      },
      setJsonContent: (json: string) => {
        if (editor) {
          try {
            editor.commands.setContent(JSON.parse(json));
          } catch {
            console.warn('Failed to parse JSON content');
          }
        }
      },
      getTiptapJsonContent: () => {
        if (!editor) return '';
        return JSON.stringify(editor.getJSON());
      },
    }));

    return (
      <div
        className={cn('flex flex-1 flex-col items-stretch gap-1', className)}
      >
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
              !disabled &&
                '[&_.tiptap_p.is-editor-empty:first-child]:before:h-0',
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
  },
);

/**
 * Extract plain text from the editor, preserving @attachments in their text format.
 * Attachments are rendered as @{id} (e.g., @image-1, @element-2).
 */
function extractTextWithMentions(editor: Editor): string {
  const doc = editor.state.doc;
  const textParts: string[] = [];

  doc.descendants((node, _pos) => {
    if (node.type.name === 'text') {
      textParts.push(node.text || '');
    } else if (ALL_ATTACHMENT_NODE_NAMES.includes(node.type.name as never)) {
      // Handle all attachment node types (fileAttachment, imageAttachment, elementAttachment)
      textParts.push(`@${node.attrs.id}`);
    } else if (node.type.name === 'paragraph') {
      // Add newline between paragraphs (except first)
      if (textParts.length > 0) textParts.push('\n');
    }
    // Return true to continue traversing children
    return true;
  });

  return textParts.join('').trim();
}

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
                <HotkeyComboText action={HotkeyActions.CTRL_I} />)
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
            accept="image/png, image/jpeg, image/gif, image/webp"
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
