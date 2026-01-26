import { useMemo } from 'react';
import { cn } from '@/utils';
import {
  AttachmentNodeView,
  ElementAttachmentView,
  ImageAttachmentView,
  TextClipAttachmentView,
} from './rich-text';

/**
 * TipTap document structure types for parsing JSON content.
 */
interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
}

interface TiptapDoc {
  type: 'doc';
  content?: TiptapNode[];
}

export interface ChatInputViewOnlyProps {
  /** TipTap JSON content string */
  tiptapJsonContent?: string;
  /** Fallback plain text content (used if no JSON content) */
  textContent?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Lightweight view-only renderer for TipTap content.
 * Renders the document as static React without initializing a TipTap editor.
 *
 * This component is used in MessageUser when not in edit mode to avoid
 * the performance overhead of creating full TipTap editor instances for
 * every message in the chat history.
 */
export function ChatInputViewOnly({
  tiptapJsonContent,
  textContent,
  className,
}: ChatInputViewOnlyProps) {
  const doc = useMemo((): TiptapDoc | null => {
    if (!tiptapJsonContent) return null;
    try {
      return JSON.parse(tiptapJsonContent) as TiptapDoc;
    } catch {
      return null;
    }
  }, [tiptapJsonContent]);

  // If no valid JSON content, render plain text fallback
  if (!doc && !textContent) return null;
  else if (!doc)
    return (
      <div className={cn('w-full', className)}>
        <p className="m-0 min-h-[1.5em] leading-relaxed">{textContent}</p>
      </div>
    );

  return (
    <div
      className={cn(
        // Match ChatInput prose styling
        'h-full w-full text-foreground text-sm',
        'prose prose-sm max-w-none',
        '[&_p]:m-0 [&_p]:leading-relaxed',
        className,
      )}
    >
      {doc.content?.map((node, index) => (
        <RenderNode key={getNodeKey(node, index)} node={node} />
      ))}
    </div>
  );
}

/**
 * Generates a stable key for a TipTap node.
 * Uses the node's id attribute if available, otherwise falls back to type + index.
 */
function getNodeKey(node: TiptapNode, index: number): string {
  const id = node.attrs?.id;
  if (typeof id === 'string' && id) return `${node.type}-${id}`;

  return `${node.type}-${index}`;
}

/**
 * Recursively renders a TipTap node as React elements.
 */
function RenderNode({ node }: { node: TiptapNode }): React.ReactNode {
  switch (node.type) {
    case 'paragraph':
      return (
        <p className="m-0 min-h-[1.5em] leading-relaxed">
          {node.content?.map((child, index) => (
            <RenderNode key={getNodeKey(child, index)} node={child} />
          ))}
        </p>
      );

    case 'text':
      return node.text ?? null;

    case 'hardBreak':
      return <br />;

    case 'elementAttachment':
      return (
        <ElementAttachmentView
          viewOnly
          selected={false}
          node={{ attrs: node.attrs ?? {} }}
        />
      );

    case 'imageAttachment':
      return (
        <ImageAttachmentView
          viewOnly
          selected={false}
          node={{ attrs: node.attrs ?? {} }}
        />
      );

    case 'fileAttachment':
      return (
        <AttachmentNodeView
          viewOnly
          selected={false}
          node={{ attrs: node.attrs ?? {} }}
        />
      );

    case 'textClipAttachment':
      return (
        <TextClipAttachmentView
          viewOnly
          selected={false}
          node={{ attrs: node.attrs ?? {} }}
        />
      );

    default:
      // Unknown node type - try to render children if any
      if (node.content)
        return node.content.map((child, index) => (
          <RenderNode key={getNodeKey(child, index)} node={child} />
        ));

      return null;
  }
}
