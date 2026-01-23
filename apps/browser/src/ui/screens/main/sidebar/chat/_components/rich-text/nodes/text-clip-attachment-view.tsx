import type { NodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import {
  ClipboardPaste,
  CopyCheckIcon,
  CopyIcon,
  Maximize2,
  XIcon,
} from 'lucide-react';
import { useMemo, useCallback, useState, useRef } from 'react';
import { cn } from '@/utils';
import { buttonVariants } from '@stagewise/stage-ui/components/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@stagewise/stage-ui/components/tooltip';
import type { TextClipAttachmentAttrs } from '../types';
import { useEditorEditable, BadgeContainer } from '../view-utils';
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from '@stagewise/stage-ui/components/preview-card';

/**
 * Truncates text content for display in the badge.
 * Shows first ~15 characters followed by "..."
 */
function truncateContent(content: string, maxLength = 15): string {
  if (content.length <= maxLength) return content;
  return `${content.substring(0, maxLength).trim()}...`;
}

/**
 * Preview component showing a truncated view of the text content.
 */
function TextPreview({ content }: { content: string }) {
  const [hasCopied, setHasCopied] = useState(false);
  const copyResetTimeoutRef = useRef<number | null>(null);

  const maxPreviewLength = 50000;
  const truncated = content.length > maxPreviewLength;
  const displayContent = truncated
    ? `${content.substring(0, maxPreviewLength)}...`
    : content;

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(content);
    setHasCopied(true);
    if (copyResetTimeoutRef.current) {
      clearTimeout(copyResetTimeoutRef.current);
    }
    copyResetTimeoutRef.current = setTimeout(
      () => setHasCopied(false),
      2000,
    ) as unknown as number;
  }, [content]);

  return (
    <>
      <span
        role="button"
        tabIndex={-1}
        onClick={copyToClipboard}
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
          'absolute top-3 right-3 z-10 size-3 shrink-0 transition-opacity',
        )}
        title="Copy to clipboard"
      >
        {hasCopied ? (
          <CopyCheckIcon className="size-3" />
        ) : (
          <CopyIcon className="size-3" />
        )}
      </span>
      <div className="max-w-96">
        <div className="flex items-center justify-start gap-1">
          <h3 className="font-medium text-foreground text-xs">Pasted text</h3>
          <span className="font-mono text-2xs text-muted-foreground">
            {'  '}({content.length.toLocaleString()} characters)
          </span>
        </div>
        <p className="scrollbar-subtle mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-2xs text-muted-foreground leading-tight">
          {displayContent}
        </p>
      </div>
    </>
  );
}

/**
 * Custom NodeView for text clip attachments (collapsed long text).
 * Displays a badge with the first few characters and provides:
 * - Hover tooltip showing preview of the full text
 * - Expand button to resolve/convert back to plain text
 * - Delete button to remove the attachment
 */
export function TextClipAttachmentView({
  node,
  deleteNode,
  selected,
  editor,
}: NodeViewProps) {
  const attrs = node.attrs as TextClipAttachmentAttrs;
  const isEditable = useEditorEditable(editor);

  const displayLabel = useMemo(
    () => truncateContent(attrs.content),
    [attrs.content],
  );

  const handleExpand = useCallback(() => {
    // Use the resolveTextClip command defined in the extension
    (
      editor.commands as { resolveTextClip?: (id: string) => boolean }
    ).resolveTextClip?.(attrs.id);
  }, [editor, attrs.id]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      deleteNode();
    },
    [deleteNode],
  );

  const handleExpandClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleExpand();
    },
    [handleExpand],
  );

  const badge = (
    <BadgeContainer selected={selected}>
      {/* Icon container - shows clipboard icon normally, X on hover when editable */}
      {isEditable ? (
        <span
          role="button"
          tabIndex={-1}
          onClick={handleDelete}
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
            'relative size-3 shrink-0',
          )}
          title="Remove"
        >
          {/* Normal icon - hidden on hover */}
          <span className="transition-opacity group-hover/badge:opacity-0">
            <ClipboardPaste className="size-3" />
          </span>
          {/* X icon - shown on hover */}
          <XIcon className="absolute inset-0 size-3 text-error opacity-0 transition-opacity group-hover/badge:opacity-100" />
        </span>
      ) : (
        <ClipboardPaste className="size-3 shrink-0" />
      )}

      {/* Label - gets gradient mask on hover when editable to allow expand button overlay */}
      <span
        className={cn(
          'max-w-24 truncate font-medium text-xs leading-none transition-[mask-image] duration-200',
          isEditable &&
            'group-hover/badge:mask-[linear-gradient(to_left,transparent_0px,transparent_20px,black_40px)]',
        )}
      >
        {displayLabel}
      </span>

      {/* Expand button - absolutely positioned overlay, appears on hover */}
      {isEditable && (
        <Tooltip>
          <TooltipTrigger>
            <span
              role="button"
              tabIndex={-1}
              onClick={handleExpandClick}
              onMouseDown={(e) => e.preventDefault()}
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
                '-translate-y-1/2 absolute top-1/2 right-0.5 hidden group-hover/badge:flex',
              )}
              title="Use raw text"
            >
              <Maximize2 className="size-2.5 text-foreground-subtle" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Use raw text</TooltipContent>
        </Tooltip>
      )}
    </BadgeContainer>
  );

  return (
    <NodeViewWrapper as="span" className="inline">
      <PreviewCard>
        <PreviewCardTrigger>{badge}</PreviewCardTrigger>
        <PreviewCardContent className="gap-2.5">
          <TextPreview content={attrs.content} />
        </PreviewCardContent>
      </PreviewCard>
    </NodeViewWrapper>
  );
}
