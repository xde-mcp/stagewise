import {
  ChevronDownIcon,
  FileIcon,
  FileTextIcon,
  FileWarningIcon,
  ImageIcon,
  Loader2Icon,
  XIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconWindowPointerOutline18 } from 'nucleo-ui-outline-18';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@stagewise/stage-ui/components/collapsible';
import { ToolPartUI } from './shared/tool-part-ui';
import { CodeBlock } from '@/components/ui/code-block';
import { StreamingCodeBlock } from '@/components/ui/streaming-code-block';
import { cn } from '@/utils';
import { useToolAutoExpand } from './shared/use-tool-auto-expand';
import { useKartonState } from '@/hooks/use-karton';
import type { AgentToolUIPart } from '@shared/karton-contracts/ui/agent';

import { getSandboxLabel } from './utils/cdp-label-utils';
import { useOpenAgent } from '@/hooks/use-open-chat';

export const ExecuteSandboxJsToolPart = ({
  part,
  capMaxHeight = false,
  showBorder = false,
  disableShimmer = false,
  isLastPart = false,
}: {
  part: Extract<AgentToolUIPart, { type: 'tool-executeSandboxJsTool' }>;
  capMaxHeight?: boolean;
  showBorder?: boolean;
  disableShimmer?: boolean;
  isLastPart?: boolean;
}) => {
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const [resultExpanded, setResultExpanded] = useState(true);
  const activeTabs = useKartonState((s) => s.browser.tabs);

  const streaming = useMemo(() => {
    return part.state === 'input-streaming' || part.state === 'input-available';
  }, [part.state]);

  const state = useMemo(() => {
    if (streaming) return 'streaming';
    if (part.state === 'output-error') return 'error';
    return 'success';
  }, [part.state, streaming]);

  // Generate contextual labels based on CDP calls in the script
  const inProgressLabel = useMemo(() => {
    return getSandboxLabel(part.input?.script, activeTabs, true);
  }, [part.input?.script, activeTabs]);

  const completedLabel = useMemo(() => {
    return getSandboxLabel(part.input?.script, activeTabs, false);
  }, [part.input?.script, activeTabs]);

  // Use the unified auto-expand hook
  const { expanded, handleUserSetExpanded } = useToolAutoExpand({
    isStreaming: streaming,
    isLastPart,
  });

  // Extract first 5 lines of the error for the collapsed preview
  const _errorPreview = useMemo(() => {
    if (!part.errorText) return null;
    return part.errorText.split('\n').slice(0, 5).join('\n');
  }, [part.errorText]);

  // Format the result as pretty-printed JSON if possible
  const formattedResult = useMemo(() => {
    const result = part.output?.result?.result;
    if (!result) return null;
    try {
      const parsed = JSON.parse(result);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If it's not valid JSON, return as-is
      return result;
    }
  }, [part.output?.result?.result]);

  const customAttachments = useMemo(() => {
    const raw = (part.output as Record<string, unknown> | undefined)
      ?._customFileAttachments;
    if (!Array.isArray(raw) || raw.length === 0) return null;
    return raw as SandboxAttachment[];
  }, [part.output]);

  const hasResultContent = !!formattedResult || !!customAttachments;

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      state !== 'success' ||
      !expanded ||
      !hasResultContent ||
      !resultRef.current
    )
      return;

    let attempts = 0;
    const maxAttempts = 15;
    let frameId: number;

    const findScrollParent = (el: HTMLElement): HTMLElement | null => {
      let node = el.parentElement;
      while (node) {
        if (
          node.hasAttribute('data-overlayscrollbars-viewport') &&
          node.scrollHeight > node.clientHeight
        )
          return node;

        node = node.parentElement;
      }
      return null;
    };

    const tryScroll = () => {
      const el = resultRef.current;
      if (!el) return;

      const scrollParent = findScrollParent(el);
      attempts++;

      if (scrollParent) {
        scrollParent.dispatchEvent(
          new WheelEvent('wheel', { deltaY: -1, bubbles: false }),
        );
        const offset =
          el.getBoundingClientRect().top -
          scrollParent.getBoundingClientRect().top -
          5;
        scrollParent.scrollTop += offset;
        return;
      }

      if (attempts < maxAttempts) frameId = requestAnimationFrame(tryScroll);
    };

    frameId = requestAnimationFrame(tryScroll);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [state, hasResultContent, expanded]);

  if (state === 'error') {
    return (
      <ToolPartUI
        showBorder={showBorder}
        expanded={expanded}
        setExpanded={handleUserSetExpanded}
        trigger={
          <>
            <XIcon className="size-3 shrink-0" />
            <div className="flex min-w-0 flex-col items-start">
              <span className="truncate text-start font-medium text-xs">
                Error while running a script
              </span>
            </div>
          </>
        }
        content={
          <div className="flex flex-col">
            {part.input?.script && (
              <Collapsible
                open={scriptExpanded}
                onOpenChange={setScriptExpanded}
              >
                <CollapsibleTrigger size="condensed" className="">
                  <ChevronDownIcon
                    className={cn(
                      'size-3 transition-transform duration-150',
                      !scriptExpanded && '-rotate-90',
                    )}
                  />
                  <span className="mb-1 text-[10px] uppercase tracking-wider">
                    Script
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="duration-0!">
                  <CodeBlock
                    code={part.input.script}
                    language="javascript"
                    hideActionButtons
                  />
                </CollapsibleContent>
              </Collapsible>
            )}
            {part.errorText && (
              <Collapsible
                open={resultExpanded}
                onOpenChange={setResultExpanded}
              >
                <CollapsibleTrigger size="condensed" className="">
                  <ChevronDownIcon
                    className={cn(
                      'size-3 transition-transform duration-150',
                      !resultExpanded && '-rotate-90',
                    )}
                  />
                  <span className="mb-1 text-[10px] uppercase tracking-wider">
                    Error
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="duration-0!">
                  <CodeBlock
                    code={part.errorText}
                    language="javascript"
                    hideActionButtons
                  />
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        }
        contentClassName={capMaxHeight ? 'max-h-80!' : undefined}
        contentFooterClassName="px-0"
      />
    );
  }

  return (
    <ToolPartUI
      showBorder={showBorder}
      expanded={expanded}
      setExpanded={handleUserSetExpanded}
      isShimmering={!disableShimmer && streaming}
      autoScroll={streaming}
      trigger={
        <>
          {!streaming && (
            <IconWindowPointerOutline18 className="size-3 shrink-0" />
          )}
          <div
            className={cn(
              'flex flex-row items-center justify-start gap-1',
              showBorder && 'flex-1',
            )}
          >
            {streaming ? (
              <LoadingHeader
                disableShimmer={disableShimmer}
                label={inProgressLabel}
              />
            ) : (
              <SuccessHeader
                capMaxHeight={capMaxHeight}
                label={completedLabel}
              />
            )}
          </div>
        </>
      }
      content={
        <>
          {part.input?.script && streaming && (
            <StreamingCodeBlock
              code={part.input.script}
              language="javascript"
            />
          )}
          {state === 'success' && part.input?.script && (
            <div className="flex flex-col">
              <Collapsible
                open={scriptExpanded}
                onOpenChange={setScriptExpanded}
              >
                <CollapsibleTrigger size="condensed" className="">
                  <ChevronDownIcon
                    className={cn(
                      'size-3 transition-transform duration-150',
                      !scriptExpanded && '-rotate-90',
                    )}
                  />
                  <span className="mb-1 text-[10px] uppercase tracking-wider">
                    Script
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="duration-0!">
                  <CodeBlock
                    code={part.input.script}
                    language="javascript"
                    hideActionButtons
                  />
                </CollapsibleContent>
              </Collapsible>
              {hasResultContent && (
                <div ref={resultRef}>
                  <Collapsible
                    open={resultExpanded}
                    onOpenChange={setResultExpanded}
                  >
                    <CollapsibleTrigger size="condensed" className="">
                      <ChevronDownIcon
                        className={cn(
                          'size-3 transition-transform duration-150',
                          !resultExpanded && '-rotate-90',
                        )}
                      />
                      <span className="mb-1 text-[10px] uppercase tracking-wider">
                        Result
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="duration-0!">
                      {customAttachments ? (
                        <AttachmentPreviewCards
                          attachments={customAttachments}
                        />
                      ) : (
                        formattedResult && (
                          <CodeBlock
                            code={formattedResult}
                            language="json"
                            hideActionButtons
                          />
                        )
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </div>
          )}
        </>
      }
      contentClassName={
        capMaxHeight ? (streaming ? 'max-h-32!' : 'max-h-80!') : undefined
      }
      contentFooterClassName="px-0"
    />
  );
};

const getFileIcon = (mediaType: string, hasError: boolean) => {
  if (hasError) return <FileWarningIcon className="size-8 text-destructive" />;
  if (mediaType.startsWith('image/'))
    return <ImageIcon className="size-8 text-muted-foreground" />;
  if (
    mediaType.startsWith('text/') ||
    mediaType === 'application/json' ||
    mediaType === 'application/pdf'
  )
    return <FileTextIcon className="size-8 text-muted-foreground" />;
  return <FileIcon className="size-8 text-muted-foreground" />;
};

interface SandboxAttachment {
  id: string;
  mediaType: string;
  fileName?: string;
  sizeBytes?: number;
}

const AttachmentPreviewCards = ({
  attachments,
}: {
  attachments: SandboxAttachment[];
}) => {
  const [openAgentId] = useOpenAgent();
  return (
    <div className="scrollbar-hover-only flex flex-row gap-2 overflow-x-auto px-1 py-2">
      {attachments.map((att) => {
        const isImage = att.mediaType.startsWith('image/');
        const blobUrl = openAgentId
          ? `sw-blob://${openAgentId}/${att.id}`
          : undefined;
        return (
          <div
            key={att.id}
            className={cn(
              'flex shrink-0 flex-col overflow-hidden rounded-lg',
              'border border-border-subtle bg-surface-1',
            )}
          >
            {isImage && blobUrl ? (
              <div className="flex min-h-24 items-center justify-center bg-background p-1.5">
                <img
                  src={blobUrl}
                  alt={att.fileName ?? att.id}
                  className="max-h-38 max-w-52 rounded object-contain"
                />
              </div>
            ) : (
              <div className="flex size-24 items-center justify-center bg-background">
                {getFileIcon(att.mediaType, false)}
              </div>
            )}
            <div className="border-border-subtle border-t px-2.5 py-1">
              <span className="max-w-48 truncate font-medium text-foreground text-xs">
                {att.fileName ?? att.id}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SuccessHeader = ({
  capMaxHeight,
  label,
}: {
  capMaxHeight?: boolean;
  label: string;
}) => {
  return (
    <div className="pointer-events-none flex flex-row items-center justify-start gap-1">
      <div className="pointer-events-auto flex flex-row items-center justify-start gap-1">
        <span
          className={cn('shrink-0 text-xs', !capMaxHeight && 'font-normal')}
        >
          {capMaxHeight ? label : <span className="font-medium">{label}</span>}
        </span>
      </div>
    </div>
  );
};

const LoadingHeader = ({
  disableShimmer,
  label,
}: {
  disableShimmer?: boolean;
  label: string;
}) => {
  return (
    <div className="flex flex-row items-center justify-start gap-1">
      <Loader2Icon
        className={cn(
          'size-3 shrink-0 animate-spin',
          disableShimmer ? '' : 'text-primary-foreground',
        )}
      />
      <span
        dir="ltr"
        className={cn('text-xs', disableShimmer ? '' : 'shimmer-text-primary')}
      >
        {label}
      </span>
    </div>
  );
};
