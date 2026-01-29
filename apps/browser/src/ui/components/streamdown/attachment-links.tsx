import { useMemo, useState, useRef, type ReactNode } from 'react';
import { ExternalLinkIcon } from 'lucide-react';
import { cn, IDE_SELECTION_ITEMS, getTruncatedFileUrl } from '@ui/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { useKartonState } from '@/hooks/use-karton';
import { useFileIDEHref } from '@ui/hooks/use-file-ide-href';
import { usePostHog } from 'posthog-js/react';
import {
  useAttachmentMetadata,
  type AttachmentMetadata,
} from '@/hooks/use-attachment-metadata';
import { MessageElementsProvider } from '@/hooks/use-message-elements';
import {
  ElementAttachmentView,
  ImageAttachmentView,
  AttachmentNodeView,
  TextClipAttachmentView,
} from '@/screens/main/sidebar/chat/_components/rich-text';
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
  | { type: 'image'; id: string }
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
  { prefix: 'image:', parse: (rest) => ({ type: 'image', id: rest }) },
  { prefix: 'file:', parse: (rest) => ({ type: 'file', id: rest }) },
  { prefix: 'text-clip:', parse: (rest) => ({ type: 'textClip', id: rest }) },
  { prefix: 'color:', parse: (rest) => ({ type: 'color', color: rest }) },
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
  const posthog = usePostHog();
  const conversationId = useKartonState(
    (s) => s.agentChat?.activeChat?.id ?? 'unknown',
  );
  const openInIdeChoice = useKartonState((s) => s.globalConfig.openFilesInIde);
  const ideName = IDE_SELECTION_ITEMS[openInIdeChoice];
  const filePathTools = useFileIDEHref();

  const displayPath = useMemo(() => {
    return getTruncatedFileUrl(filePath, 3, 128);
  }, [filePath]);

  const processedHref = useMemo(() => {
    const pathWithLine = lineNumber ? `${filePath}:${lineNumber}` : filePath;
    let href = filePathTools.getFileIDEHref(pathWithLine);
    href = href.replaceAll(
      encodeURIComponent('{{CONVERSATION_ID}}'),
      conversationId,
    );
    return href;
  }, [filePath, lineNumber, filePathTools, conversationId]);

  return (
    <Tooltip>
      <TooltipTrigger>
        <a
          href={processedHref}
          onClick={() =>
            posthog?.capture('agent_file_opened_in_ide_via_chat_link', {
              file_path: filePath,
              ide: openInIdeChoice,
            })
          }
          className={cn(
            'inline-flex items-center gap-0.5',
            'font-medium text-primary-foreground text-sm',
            'hover:text-hover-derived',
            'break-all',
            incomplete && 'opacity-70',
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          {displayPath || '...'}
          {lineNumber && (
            <span className="shrink-0 opacity-70">:{lineNumber}</span>
          )}
          <ExternalLinkIcon className="size-3 shrink-0" />
        </a>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1">
          <div className="font-mono text-xs">{decodeURI(processedHref)}</div>
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
 * Wraps with MessageElementsProvider so the view can look up element data.
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

  // Provide element via context so ElementAttachmentView's useMessageElements() can find it
  return (
    <MessageElementsProvider elements={element ? [element] : []}>
      <ElementAttachmentView
        viewOnly
        selected={false}
        node={{ attrs: { id, label } }}
      />
    </MessageElementsProvider>
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
