import { NodeViewWrapper } from '@tiptap/react';
import { PreviewCard as PreviewCardBase } from '@base-ui/react/preview-card';
import { XIcon, AlertTriangleIcon } from 'lucide-react';
import { useCallback, forwardRef } from 'react';
import { cn } from '@/utils';
import { PreviewCard } from '@stagewise/stage-ui/components/preview-card';
import { buttonVariants } from '@stagewise/stage-ui/components/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@stagewise/stage-ui/components/tooltip';

/**
 * Truncates a label for display, preserving file extensions.
 * If the label is longer than 20 characters, it truncates the base name
 * while keeping the extension visible.
 *
 * @param label - The label to truncate
 * @param fallbackId - Fallback value if label is empty
 * @returns The truncated label
 */
export function truncateLabel(
  label: string | undefined,
  fallbackId: string,
): string {
  if (!label) return fallbackId;
  if (label.length > 20) {
    const lastDot = label.lastIndexOf('.');
    const base = lastDot > 0 ? label.substring(0, lastDot) : label;
    const ext = lastDot > 0 ? label.substring(lastDot) : '';

    if (base.length > 15) return `${base.substring(0, 15)}...${ext}`;

    return `${base}${ext}`;
  }
  return label;
}

export interface BadgeContainerProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Whether the node is currently selected in the editor */
  selected?: boolean;
  /** Children to render inside the badge */
  children: React.ReactNode;
}

/**
 * Base container component for attachment badges.
 * Provides consistent styling for the badge shell.
 * Use this when building custom badge layouts that need the same visual styling.
 */
export const BadgeContainer = forwardRef<HTMLSpanElement, BadgeContainerProps>(
  function BadgeContainer({ selected, className, children, ...props }, ref) {
    return (
      <span
        ref={ref}
        className={cn(
          'group/badge -translate-y-px relative inline-flex h-4 cursor-default items-center gap-1 rounded bg-inherit px-1.5 align-middle text-secondary-foreground ring-1',
          'ring-1 ring-derived group-hover/chat-message-user:bg-hover-derived group-hover/chat-message-user:ring-derived-strong dark:bg-surface-tinted dark:group-hover/chat-message-user:ring-derived-strong',
          selected && 'ring-primary-foreground',
          className,
        )}
        contentEditable={false}
        {...props}
      >
        {children}
      </span>
    );
  },
);

export interface AttachmentBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Icon to display (e.g., file icon, image thumbnail, element icon) */
  icon: React.ReactNode;
  /** Label text to display */
  label: string;
  /** Whether the node is currently selected in the editor */
  selected: boolean;
  /** Whether the editor is in editable mode */
  isEditable: boolean;
  /** Callback when delete button is clicked */
  onDelete: () => void;
  /** Whether the attachment has a validation error (unsupported type/size) */
  hasError?: boolean;
}

/**
 * Reusable badge component for attachment nodes.
 * Displays an icon, truncated label, and shows a delete button on hover when editable.
 * Forwards refs and spreads additional props for compatibility with Base UI triggers.
 */
export const AttachmentBadge = forwardRef<
  HTMLSpanElement,
  AttachmentBadgeProps
>(function AttachmentBadge(
  {
    icon,
    label,
    selected,
    isEditable,
    onDelete,
    hasError,
    className,
    ...props
  },
  ref,
) {
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDelete();
    },
    [onDelete],
  );

  // Show warning icon when there's a validation error
  const displayIcon = hasError ? (
    <AlertTriangleIcon className="size-3 shrink-0 text-warning" />
  ) : (
    icon
  );

  return (
    <BadgeContainer
      ref={ref}
      selected={selected}
      className={cn(hasError && 'opacity-50', className)}
      {...props}
    >
      {/* Icon container - shows type icon normally, X on hover when editable */}
      {isEditable ? (
        <span
          role="button"
          tabIndex={-1}
          onClick={handleDelete}
          onMouseDown={(e) => e.preventDefault()} // Prevent editor blur
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
            'relative size-3 shrink-0 overflow-hidden',
          )}
        >
          {/* Normal icon - hidden on hover */}
          <span className="transition-opacity group-hover/badge:opacity-0">
            {displayIcon}
          </span>
          {/* X icon - shown on hover */}
          <XIcon className="absolute inset-0 size-3 text-error opacity-0 transition-opacity group-hover/badge:opacity-100" />
        </span>
      ) : (
        displayIcon
      )}

      {/* Label */}
      <span className="max-w-24 truncate font-medium text-xs leading-none">
        {label}
      </span>
    </BadgeContainer>
  );
});

export interface AttachmentBadgeWrapperProps {
  /** The badge content to wrap (must be a single React element for PreviewCardTrigger) */
  children: React.ReactElement;
  /** Optional preview content shown on hover */
  previewContent?: React.ReactNode;
  /** Optional tooltip content shown on hover, only shown if previewContent is not provided */
  tooltipContent?: React.ReactNode;
  /** Optional viw-only mode, will return a span instead of a NodeViewWrapper */
  viewOnly?: boolean;
  /** Error message to display (overrides previewContent/tooltipContent when set) */
  errorMessage?: string;
}

function Wrapper({
  viewOnly,
  children,
}: {
  viewOnly: boolean;
  children: React.ReactNode;
}) {
  if (viewOnly)
    return <span className="inline shrink-0 px-0.5 pt-px">{children}</span>;

  return (
    <NodeViewWrapper as="span" className="inline">
      {children}
    </NodeViewWrapper>
  );
}

/**
 * Wrapper component that provides NodeViewWrapper and optional PreviewCard.
 * Use this to wrap your AttachmentBadge for consistent behavior across attachment types.
 */
export function AttachmentBadgeWrapper({
  children,
  previewContent,
  tooltipContent,
  viewOnly,
  errorMessage,
}: AttachmentBadgeWrapperProps) {
  // Error message takes priority - show as tooltip
  if (errorMessage) {
    return (
      <Wrapper viewOnly={viewOnly ?? false}>
        <Tooltip>
          <TooltipTrigger render={children} />
          <TooltipContent>
            <span className="text-warning">{errorMessage}</span>
          </TooltipContent>
        </Tooltip>
      </Wrapper>
    );
  }

  return (
    <Wrapper viewOnly={viewOnly ?? false}>
      {previewContent ? (
        <PreviewCard>
          <PreviewCardBase.Trigger
            delay={100}
            closeDelay={100}
            render={children}
          />
          {previewContent}
        </PreviewCard>
      ) : (
        <Tooltip>
          <TooltipTrigger render={children} />
          <TooltipContent>{tooltipContent}</TooltipContent>
        </Tooltip>
      )}
    </Wrapper>
  );
}
