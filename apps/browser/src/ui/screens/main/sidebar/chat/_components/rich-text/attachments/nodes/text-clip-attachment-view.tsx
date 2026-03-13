import {
  ClipboardPaste,
  CopyCheckIcon,
  CopyIcon,
  Maximize2,
  XIcon,
} from 'lucide-react';
import { useMemo, useCallback, useState, useRef } from 'react';
import { cn } from '@ui/utils';
import { buttonVariants } from '@stagewise/stage-ui/components/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@stagewise/stage-ui/components/tooltip';
import { PreviewCardContent } from '@stagewise/stage-ui/components/preview-card';
import type { TextClipAttachmentAttrs } from '../types';
import type { InlineNodeViewProps } from '../../shared/types';
import { BadgeContainer, InlineBadgeWrapper } from '../../shared';
import { useMessageAttachments } from '@ui/hooks/use-message-elements';

/**
 * Truncates text content for display in the badge.
 * Shows first ~15 characters followed by "..."
 */
function truncateContent(content: string, maxLength = 15): string {
  if (content.length <= maxLength) return content;
  return `${content.substring(0, maxLength).trim()}...`;
}

/**
 * Preview content component showing text content with copy functionality.
 */
function TextPreviewContent({ content }: { content: string }) {
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
    <PreviewCardContent className="gap-2.5">
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
    </PreviewCardContent>
  );
}

/**
 * Custom NodeView for text clip attachments (collapsed long text).
 * Displays a badge with the first few characters and provides:
 * - Hover tooltip showing preview of the full text
 * - Expand button to resolve/convert back to plain text
 * - Delete button to remove the attachment
 * Looks up attachment data (content) from context by ID.
 */
export function TextClipAttachmentView(props: InlineNodeViewProps) {
  const attrs = props.node.attrs as TextClipAttachmentAttrs;
  const isEditable = !('viewOnly' in props);

  // Look up full attachment data from context
  const { textClipAttachments } = useMessageAttachments();
  const attachment = useMemo(
    () => textClipAttachments.find((t) => t.id === attrs.id),
    [textClipAttachments, attrs.id],
  );

  // Prefer context data (saved attachments), fall back to attrs (new attachments being composed)
  const content = attachment?.content ?? attrs.content ?? '';
  const _label = attachment?.label ?? attrs.label;

  const displayLabel = useMemo(() => truncateContent(content), [content]);

  const handleExpand = useCallback(() => {
    // Use the resolveTextClip command defined in the extension
    ('editor' in props && 'resolveTextClip' in props.editor.commands
      ? props.editor.commands.resolveTextClip
      : undefined)?.(attrs.id);
  }, [props, attrs.id]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      'deleteNode' in props ? props.deleteNode() : undefined;
    },
    [props],
  );

  const handleExpandClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleExpand();
    },
    [handleExpand],
  );

  // Custom badge with expand button (unique to text-clip)
  const badge = (
    <BadgeContainer selected={props.selected} editMode={isEditable}>
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
            <ClipboardPaste className="size-3 text-foreground" />
          </span>
          {/* X icon - shown on hover */}
          <XIcon className="absolute inset-0 size-3 text-error opacity-0 transition-opacity group-hover/badge:opacity-100" />
        </span>
      ) : (
        <ClipboardPaste className="size-3" />
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

  // Preview content for the hover card
  const previewContent = <TextPreviewContent content={content} />;

  return (
    <InlineBadgeWrapper viewOnly={!isEditable} previewContent={previewContent}>
      {badge}
    </InlineBadgeWrapper>
  );
}
