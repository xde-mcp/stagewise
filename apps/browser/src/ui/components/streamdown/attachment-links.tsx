import { useMemo, useState, useRef, type ReactNode } from 'react';
import { ExternalLinkIcon } from 'lucide-react';
import {
  cn,
  IDE_SELECTION_ITEMS,
  getTruncatedFileUrl,
  stripMountPrefix,
} from '@ui/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { useKartonState } from '@/hooks/use-karton';
import { useFileIDEHref } from '@ui/hooks/use-file-ide-href';
import { useOpenAgent } from '@ui/hooks/use-open-chat';
import { usePostHog } from 'posthog-js/react';
import { IdePickerPopover } from '@ui/components/ide-picker-popover';
import {
  useAttachmentMetadata,
  type AttachmentMetadata,
} from '@ui/hooks/use-attachment-metadata';
import { MessageAttachmentsProvider } from '@ui/hooks/use-message-elements';
import {
  ElementAttachmentView,
  ImageAttachmentView,
  AttachmentNodeView,
  TextClipAttachmentView,
} from '@ui/screens/main/sidebar/chat/_components/rich-text';
import type { SelectedElement } from '@shared/selected-elements';

interface ColorBadgeProps {
  /** The CSS color value */
  color: string;
  /** Optional label to display (defaults to color value) */
  children?: ReactNode;
}

/**
 * Inline color badge with color swatch and copy-to-clipboard functionality.
 * Used by both inline code detection and explicit color: links.
 */
export const ColorBadge = ({ color, children }: ColorBadgeProps) => {
  const [hasCopied, setHasCopied] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const ignoreCloseRef = useRef(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(color);
    setHasCopied(true);
    setTooltipOpen(true);
    // Briefly prevent the click-triggered close, but allow hover-out to work
    ignoreCloseRef.current = true;
    setTimeout(() => {
      ignoreCloseRef.current = false;
    }, 50); // Short delay to ignore only the click-triggered close
    // Reset "Copied" text after 2 seconds
    setTimeout(() => {
      setHasCopied(false);
    }, 2000);
  };

  const handleOpenChange = (open: boolean) => {
    // Ignore the immediate close triggered by clicking, but allow hover-out
    if (!open && ignoreCloseRef.current) return;
    setTooltipOpen(open);
  };

  return (
    <Tooltip open={tooltipOpen} onOpenChange={handleOpenChange}>
      <TooltipTrigger>
        <span
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            copyToClipboard();
          }}
          className={cn(
            'group/inline-color rounded bg-surface-1 px-1.5 py-0.5 font-mono text-foreground text-xs',
            'inline-flex cursor-pointer items-center hover:bg-hover-derived hover:text-hover-derived active:bg-active-derived active:text-active-derived',
          )}
        >
          <span
            className="mr-1 inline-block size-3 shrink-0 rounded-sm border border-derived align-middle group-hover/inline-color:border-derived-strong! group-hover/inline-color:bg-hover-derived! group-active/inline-color:border-derived-strong! group-active/inline-color:bg-active-derived!"
            style={
              {
                backgroundColor: color,
                '--cm-bg-color': color,
              } as React.CSSProperties
            }
            aria-hidden="true"
          />
          {children ?? color}
        </span>
      </TooltipTrigger>
      <TooltipContent>{hasCopied ? 'Copied' : 'Copy'}</TooltipContent>
    </Tooltip>
  );
};
/**
 * Parsed attachment link data - discriminated union for type safety.
 */
export type AttachmentLinkData =
  | { type: 'element'; id: string }
  | { type: 'image'; id: string; displayHint?: 'expanded' }
  | { type: 'file'; id: string }
  | { type: 'textClip'; id: string }
  | { type: 'color'; color: string }
  | {
      type: 'wsfile';
      filePath: string;
      lineNumber?: string;
      incomplete?: boolean;
    };

/**
 * Pattern definitions for attachment link parsing.
 * Each pattern maps a URL prefix to a parser function.
 */
const ATTACHMENT_LINK_PATTERNS: Array<{
  prefix: string;
  parse: (rest: string) => AttachmentLinkData;
}> = [
  { prefix: 'element:', parse: (rest) => ({ type: 'element', id: rest }) },
  {
    prefix: 'image:',
    parse: (rest) => {
      const [id, fragment] = rest.split('#', 2);
      return {
        type: 'image',
        id,
        displayHint: fragment === 'expanded' ? 'expanded' : undefined,
      };
    },
  },
  { prefix: 'file:', parse: (rest) => ({ type: 'file', id: rest }) },
  { prefix: 'text-clip:', parse: (rest) => ({ type: 'textClip', id: rest }) },
  {
    prefix: 'color:',
    // Decode URL-encoded color values (encoded in preprocessMarkdown to handle parens)
    parse: (rest) => ({ type: 'color', color: decodeURIComponent(rest) }),
  },
  {
    prefix: 'wsfile:',
    parse: (rest) => {
      const incomplete = rest.startsWith('incomplete:');
      const path = incomplete ? rest.slice('incomplete:'.length) : rest;
      const colonIndex = path.lastIndexOf(':');
      // Check if there's a line number (colon followed by digits)
      const hasLineNumber =
        colonIndex > 0 && /^\d+$/.test(path.slice(colonIndex + 1));
      const filePath = hasLineNumber ? path.slice(0, colonIndex) : path;
      const lineNumber = hasLineNumber ? path.slice(colonIndex + 1) : undefined;
      return { type: 'wsfile', filePath, lineNumber, incomplete };
    },
  },
];

/**
 * Parse an href to detect attachment link types.
 * Returns structured data if the href matches a known pattern, null otherwise.
 *
 * @param href - The href attribute from an anchor element
 * @returns Parsed attachment data or null for regular links
 */
export function parseAttachmentLink(
  href: string | undefined,
): AttachmentLinkData | null {
  if (!href) return null;

  for (const { prefix, parse } of ATTACHMENT_LINK_PATTERNS) {
    if (href.startsWith(prefix)) {
      return parse(href.slice(prefix.length));
    }
  }
  return null;
}

export type MessageSegment =
  | { kind: 'text'; content: string }
  | { kind: 'attachment'; linkData: AttachmentLinkData };

/**
 * Parse markdown text into alternating text and attachment-link segments.
 * Extracts markdown links whose href matches a known attachment prefix
 * (element:, image:, file:, text-clip:, color:, wsfile:) and returns them
 * as structured segments alongside plain text.
 *
 * Uses balanced-parenthesis matching so color values like
 * `rgba(0, 0, 0)` are handled correctly.
 */
export function parseMessageSegments(text: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const linkStartRegex = /\[(?:[^\]]*)\]\(/g;
  // Derive prefixes from the single source of truth
  const prefixes = ATTACHMENT_LINK_PATTERNS.map((p) => p.prefix);
  let lastEnd = 0;
  let match = linkStartRegex.exec(text);

  while (match !== null) {
    const hrefStart = match.index + match[0].length;
    const rest = text.slice(hrefStart);

    if (!prefixes.some((p) => rest.startsWith(p))) {
      match = linkStartRegex.exec(text);
      continue;
    }

    // Use balanced parentheses to find the closing )
    let depth = 1;
    let i = 0;
    for (; i < rest.length; i++) {
      if (rest[i] === '(') depth++;
      if (rest[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) {
      match = linkStartRegex.exec(text);
      continue;
    }

    const href = rest.slice(0, i);
    const parsed = parseAttachmentLink(href);
    if (!parsed) {
      match = linkStartRegex.exec(text);
      continue;
    }

    if (match.index > lastEnd) {
      segments.push({
        kind: 'text',
        content: text.slice(lastEnd, match.index),
      });
    }
    segments.push({ kind: 'attachment', linkData: parsed });
    lastEnd = hrefStart + i + 1;
    match = linkStartRegex.exec(text);
  }

  if (lastEnd < text.length)
    segments.push({ kind: 'text', content: text.slice(lastEnd) });

  return segments;
}

/** Get a stable React key from attachment link data. */
export function getAttachmentKey(linkData: AttachmentLinkData): string {
  switch (linkData.type) {
    case 'element':
    case 'image':
    case 'file':
    case 'textClip':
      return `${linkData.type}-${linkData.id}`;
    case 'wsfile':
      return `wsfile-${linkData.filePath}`;
    case 'color':
      return `color-${linkData.color}`;
  }
}

interface WorkspaceFileLinkProps {
  filePath: string;
  lineNumber?: string;
  incomplete?: boolean;
}

/**
 * Renders a workspace file link that opens in the configured IDE.
 * Handles both complete and incomplete (streaming) file paths.
 */
export const WorkspaceFileLink = ({
  filePath,
  lineNumber,
  incomplete,
}: WorkspaceFileLinkProps) => {
  const _posthog = usePostHog();
  const [openAgent] = useOpenAgent();
  const openInIdeChoice = useKartonState((s) => s.globalConfig.openFilesInIde);
  const ideName = IDE_SELECTION_ITEMS[openInIdeChoice];
  const { getFileIDEHref, needsIdePicker, pickIdeAndOpen } = useFileIDEHref();

  const strippedPath = stripMountPrefix(filePath);

  const displayPath = useMemo(() => {
    return getTruncatedFileUrl(strippedPath, 3, 128);
  }, [strippedPath]);

  const displayPathWithLine = lineNumber
    ? `${strippedPath}:${lineNumber}`
    : strippedPath;
  const pathWithLine = lineNumber ? `${filePath}:${lineNumber}` : filePath;

  const processedHref = useMemo(() => {
    if (!openAgent) return '';
    let href = getFileIDEHref(pathWithLine);
    href = href.replaceAll(
      encodeURIComponent('{{CONVERSATION_ID}}'),
      openAgent,
    );
    return href;
  }, [pathWithLine, getFileIDEHref, openAgent]);

  const parsedLineNumber = lineNumber
    ? Number.parseInt(lineNumber, 10)
    : undefined;

  const anchor = (
    <a
      href={needsIdePicker ? '#' : processedHref}
      className={cn(
        'inline-flex items-center gap-0.5',
        'font-medium text-primary-foreground text-sm',
        'hover:text-hover-derived',
        'break-all',
        incomplete && 'opacity-70',
      )}
      target={needsIdePicker ? undefined : '_blank'}
      rel="noopener noreferrer"
      onClick={needsIdePicker ? (e) => e.preventDefault() : undefined}
    >
      {displayPath || '...'}
      {lineNumber && <span className="shrink-0 opacity-70">:{lineNumber}</span>}
      <ExternalLinkIcon className="size-3 shrink-0" />
    </a>
  );

  if (needsIdePicker) {
    return (
      <IdePickerPopover
        onSelect={(ide) => pickIdeAndOpen(ide, pathWithLine, parsedLineNumber)}
      >
        {anchor}
      </IdePickerPopover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger>{anchor}</TooltipTrigger>
      <TooltipContent>
        <div className="flex max-w-96 flex-col gap-1">
          <div className="break-all font-mono text-xs">
            {displayPathWithLine}
          </div>
          <div className="text-muted-foreground text-xs">
            Click to open in {ideName}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

interface AttachmentLinkBaseProps {
  id: string;
  metadata: AttachmentMetadata | undefined;
}

/**
 * Element attachment link - reuses ElementAttachmentView in view-only mode.
 * Wraps with MessageAttachmentsProvider so the view can look up element data.
 */
export const ElementAttachmentLink = ({
  id,
  metadata,
}: AttachmentLinkBaseProps) => {
  // Check if metadata is a SelectedElement
  const element: SelectedElement | null =
    metadata && 'tagName' in metadata ? (metadata as SelectedElement) : null;

  // Build label from element data
  const label = useMemo(() => {
    if (!element) return `@${id.slice(0, 8)}`;
    const tagName = element.tagName.toLowerCase();
    const domId = element.attributes?.id ? `#${element.attributes.id}` : '';
    return `${tagName}${domId}`;
  }, [id, element]);

  // Provide element via context so ElementAttachmentView can find it
  return (
    <MessageAttachmentsProvider elements={element ? [element] : []}>
      <ElementAttachmentView
        viewOnly
        selected={false}
        node={{ attrs: { id, label } }}
      />
    </MessageAttachmentsProvider>
  );
};

/**
 * Image attachment link - reuses ImageAttachmentView in view-only mode.
 */
export const ImageAttachmentLink = ({
  id,
  metadata,
}: AttachmentLinkBaseProps) => {
  // Extract url, label, and validationError from FileAttachment metadata
  const { url, label, validationError } = useMemo(() => {
    if (!metadata || !('url' in metadata)) {
      return { url: '', label: 'image', validationError: undefined };
    }
    return {
      url: metadata.url,
      label:
        'fileName' in metadata && metadata.fileName
          ? metadata.fileName
          : 'image',
      validationError:
        'validationError' in metadata ? metadata.validationError : undefined,
    };
  }, [metadata]);

  return (
    <ImageAttachmentView
      viewOnly
      selected={false}
      node={{ attrs: { id, label, url, validationError } }}
    />
  );
};

/**
 * Expanded image attachment link - renders as a large inline preview card.
 * Used when the agent specifies `#expanded` on an image link.
 */
export const ExpandedImageAttachmentLink = ({
  id,
  metadata,
}: AttachmentLinkBaseProps) => {
  const { url, label } = useMemo(() => {
    if (!metadata || !('url' in metadata)) return { url: '', label: 'image' };
    return {
      url: metadata.url,
      label:
        'fileName' in metadata && metadata.fileName
          ? metadata.fileName
          : 'image',
    };
  }, [metadata]);

  if (!url) return <ImageAttachmentLink id={id} metadata={metadata} />;

  return (
    <div
      className={cn(
        'my-1 inline-flex shrink-0 flex-col overflow-hidden rounded-lg',
        'border border-border-subtle bg-surface-1',
      )}
    >
      <div className="flex min-h-24 items-center justify-center bg-background p-1.5">
        <img
          src={url}
          alt={label}
          className="max-h-38 max-w-52 rounded object-contain"
        />
      </div>
      <div className="border-border-subtle border-t px-2.5 py-1.5">
        <span className="max-w-48 truncate font-medium text-foreground text-xs">
          {label}
        </span>
      </div>
    </div>
  );
};

/**
 * File attachment link - reuses AttachmentNodeView (fallback) in view-only mode.
 */
export const FileAttachmentLink = ({
  id,
  metadata,
}: AttachmentLinkBaseProps) => {
  const { label, validationError } = useMemo(() => {
    if (!metadata) return { label: 'file', validationError: undefined };
    return {
      label:
        'fileName' in metadata && metadata.fileName
          ? metadata.fileName
          : 'file',
      validationError:
        'validationError' in metadata ? metadata.validationError : undefined,
    };
  }, [metadata]);

  return (
    <AttachmentNodeView
      viewOnly
      selected={false}
      node={{ attrs: { id, label, validationError } }}
    />
  );
};

/**
 * Text clip attachment link - reuses TextClipAttachmentView in view-only mode.
 */
export const TextClipAttachmentLink = ({
  id,
  metadata,
}: AttachmentLinkBaseProps) => {
  const { label, content } = useMemo(() => {
    if (!metadata || !('content' in metadata)) {
      return { label: 'text', content: '' };
    }
    return {
      label: 'label' in metadata ? metadata.label : 'text',
      content: metadata.content,
    };
  }, [metadata]);

  return (
    <TextClipAttachmentView
      viewOnly
      selected={false}
      node={{ attrs: { id, label, content } }}
    />
  );
};

interface AttachmentLinkRouterProps {
  linkData: AttachmentLinkData;
}

/**
 * Routes parsed attachment link data to the appropriate component.
 * Uses the attachment metadata context for context-dependent links.
 */
export const AttachmentLinkRouter = ({
  linkData,
}: AttachmentLinkRouterProps) => {
  const attachments = useAttachmentMetadata();

  switch (linkData.type) {
    case 'element':
      return (
        <ElementAttachmentLink
          id={linkData.id}
          metadata={attachments[linkData.id]}
        />
      );
    case 'image':
      if (linkData.displayHint === 'expanded') {
        return (
          <ExpandedImageAttachmentLink
            id={linkData.id}
            metadata={attachments[linkData.id]}
          />
        );
      }
      return (
        <ImageAttachmentLink
          id={linkData.id}
          metadata={attachments[linkData.id]}
        />
      );
    case 'file':
      return (
        <FileAttachmentLink
          id={linkData.id}
          metadata={attachments[linkData.id]}
        />
      );
    case 'textClip':
      return (
        <TextClipAttachmentLink
          id={linkData.id}
          metadata={attachments[linkData.id]}
        />
      );
    case 'wsfile':
      return (
        <WorkspaceFileLink
          filePath={linkData.filePath}
          lineNumber={linkData.lineNumber}
          incomplete={linkData.incomplete}
        />
      );
    case 'color':
      // Render color badge (same component used by inline code detection)
      return <ColorBadge color={linkData.color} />;
  }
};
