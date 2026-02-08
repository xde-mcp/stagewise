import { Button } from '@stagewise/stage-ui/components/button';
import type { FileDiff } from '@shared/karton-contracts/ui/shared-types';
import {
  IconTrash2Outline24,
  IconArrowUpOutline24,
} from 'nucleo-core-outline-24';
import { ChevronDownIcon } from 'lucide-react';
import { FileIcon } from './message-part-ui/tools/shared/file-icon';
import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import { diffLines } from 'diff';
import { cn } from '@/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@stagewise/stage-ui/components/collapsible';

import type { AgentMessage } from '@shared/karton-contracts/ui/agent';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { useOpenAgent } from '@/hooks/use-open-chat';
import {
  AttachmentLinkRouter,
  parseMessageSegments,
  getAttachmentKey,
} from '@/components/streamdown/attachment-links';
import { AttachmentMetadataProvider } from '@/hooks/use-attachment-metadata';

// Stable empty array to avoid creating new instances in selectors (prevents infinite loops)
const _EMPTY_MESSAGE_QUEUE: AgentMessage[] = [];

/** Extract text content from a AgentMessage's parts */
function getMessageText(message: {
  parts: { type: string; text?: string }[];
}): string {
  const textPart = message.parts.find((p) => p.type === 'text');
  return textPart && 'text' in textPart ? (textPart.text ?? '') : '';
}

type FormattedFileDiff = {
  fileId: string;
  path: string;
  fileName: string;
  linesAdded: number;
  linesRemoved: number;
  hunkIds: string[];
};

interface StatusCardSection {
  trigger: (isOpen: boolean) => React.ReactNode;
  contentClassName?: string;
  content: React.ReactNode;
  key: string;
  defaultOpen?: boolean;
}

interface FileDiffSectionProps {
  pendingDiffs: FormattedFileDiff[];
  diffSummary: FormattedFileDiff[];
  onRejectAll: (hunkIds: string[]) => void;
  onAcceptAll: (hunkIds: string[]) => void;
  onOpenDiffReview: (fileId: string) => void;
}

interface QueuedMessagesSectionProps {
  queuedMessages: AgentMessage[];
  onRemoveMessage: (messageId: string) => Promise<void>;
  onFlush: () => Promise<void>;
}

function StatusCardSectionComponent({
  item,
  showDivider,
}: {
  item: StatusCardSection;
  showDivider: boolean;
}) {
  const [isOpen, setIsOpen] = useState(item.defaultOpen ?? true);

  return (
    <div className="w-full">
      <Collapsible className="w-full" open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger
          size="condensed"
          className="w-full cursor-pointer p-0 hover:bg-transparent active:bg-transparent"
        >
          {item.trigger(isOpen)}
        </CollapsibleTrigger>
        <CollapsibleContent
          className={cn('w-full overflow-hidden', item.contentClassName)}
        >
          {item.content}
        </CollapsibleContent>
      </Collapsible>
      {showDivider && (
        <hr className="my-1 h-px w-[calc(100%+6px)] border-derived-subtle bg-background" />
      )}
    </div>
  );
}

function StatusCardComponent({
  items,
  ref,
}: {
  items: StatusCardSection[];
  ref?: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      className="-z-10 absolute right-2 bottom-[calc(100%+1px)] left-2 flex flex-col items-center justify-between rounded-t-lg border-derived border-t border-r border-l bg-background p-1 backdrop-blur-lg"
    >
      {items.map((item, index) => (
        <StatusCardSectionComponent
          key={item.key}
          item={item}
          showDivider={index < items.length - 1}
        />
      ))}
    </div>
  );
}

function FileDiffSection(
  props: FileDiffSectionProps,
): StatusCardSection | null {
  const {
    pendingDiffs,
    diffSummary,
    onRejectAll,
    onAcceptAll,
    onOpenDiffReview,
  } = props;

  if (pendingDiffs?.length === 0 && diffSummary?.length === 0) return null;

  return {
    key: 'file-diff',
    trigger: (isOpen: boolean) => (
      <div className="flex w-full flex-row items-center justify-between gap-2 pl-1.5 text-muted-foreground text-xs hover:text-foreground has-[button:hover]:text-muted-foreground">
        <ChevronDownIcon
          className={cn(
            'size-3 shrink-0 transition-transform duration-50',
            isOpen && 'rotate-180',
          )}
        />
        {pendingDiffs?.length > 0 ? (
          `${pendingDiffs.length} Edit${pendingDiffs.length > 1 ? 's' : ''}`
        ) : (
          <span>
            {diffSummary.length} Edit{diffSummary.length > 1 ? 's' : ''}
          </span>
        )}

        {pendingDiffs?.length > 0 ? (
          <div className="ml-auto flex flex-row items-center justify-start gap-1">
            <Button
              variant="ghost"
              size="xs"
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onRejectAll(
                  pendingDiffs?.flatMap((diff) => diff.hunkIds) ?? [],
                );
              }}
            >
              Reject
            </Button>
            <Button
              variant="primary"
              size="xs"
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onAcceptAll(
                  pendingDiffs?.flatMap((diff) => diff.hunkIds) ?? [],
                );
              }}
            >
              Accept all
            </Button>
          </div>
        ) : (
          <div className="ml-auto h-6" />
        )}
      </div>
    ),
    contentClassName: 'px-0',
    content: (
      <div className="pt-1">
        {pendingDiffs?.length > 0
          ? pendingDiffs?.map((edit) => (
              <FileDiffFileItem
                key={edit.path}
                fileDiff={edit}
                onOpenDiffReview={onOpenDiffReview}
              />
            ))
          : diffSummary?.length > 0
            ? diffSummary?.map((edit) => (
                <FileDiffFileItem
                  key={edit.path}
                  fileDiff={edit}
                  onOpenDiffReview={onOpenDiffReview}
                />
              ))
            : null}
      </div>
    ),
  };
}

function FileDiffFileItem({
  fileDiff,
  onOpenDiffReview,
}: {
  fileDiff: FormattedFileDiff;
  onOpenDiffReview: (fileId: string) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full cursor-pointer flex-col items-start justify-start gap-2 rounded px-1 py-0.5 text-foreground hover:bg-surface-1 hover:text-hover-derived"
      onClick={() => onOpenDiffReview(fileDiff.fileId)}
    >
      <span className="flex flex-row items-center justify-start gap-1 truncate text-xs">
        <FileIcon filePath={fileDiff.fileName} className="size-5 shrink-0" />
        <span className="text-xs leading-none">{fileDiff.fileName}</span>
        {fileDiff.linesAdded > 0 && (
          <span className="text-[10px] text-success-foreground leading-none hover:text-hover-derived">
            +{fileDiff.linesAdded}
          </span>
        )}
        {fileDiff.linesRemoved > 0 && (
          <span className="text-[10px] text-error-foreground leading-none hover:text-hover-derived">
            -{fileDiff.linesRemoved}
          </span>
        )}
      </span>
    </button>
  );
}

function MessageQueueSectionContent({
  queuedMessages,
  onRemoveMessage,
}: QueuedMessagesSectionProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="pt-1" onMouseLeave={() => setHoveredIndex(null)}>
      {queuedMessages.map((queuedMsg, index) => {
        const isFirst = index === 0;
        // Show buttons for first item when nothing is hovered, or when this specific item is hovered
        const showButtons = isFirst
          ? hoveredIndex === null || hoveredIndex === 0
          : hoveredIndex === index;

        return (
          <div
            key={queuedMsg.id}
            className="relative flex w-full flex-row items-center rounded px-1 py-0.5 text-foreground hover:bg-surface-1 hover:text-hover-derived"
            onMouseEnter={() => setHoveredIndex(index)}
          >
            <div className="flex size-5 shrink-0 items-center justify-center">
              <div className="size-1 rounded-full bg-foreground" />
            </div>
            <span
              className={cn(
                'inline-flex w-full items-center gap-0.5 overflow-x-hidden text-ellipsis whitespace-nowrap text-xs transition-[mask-image] duration-200',
                showButtons
                  ? 'mask-[linear-gradient(to_left,transparent_0px,transparent_56px,black_88px)]'
                  : 'mask-[linear-gradient(to_left,transparent_0px,black_24px)]',
              )}
            >
              {parseMessageSegments(getMessageText(queuedMsg)).map((seg) =>
                seg.kind === 'text' ? (
                  seg.content
                ) : (
                  <AttachmentLinkRouter
                    key={getAttachmentKey(seg.linkData)}
                    linkData={seg.linkData}
                  />
                ),
              )}
            </span>
            <div
              className={cn(
                '-translate-y-1/2 absolute top-1/2 right-1 flex-row items-center',
                showButtons ? 'flex' : 'hidden',
              )}
            >
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => {
                      void onRemoveMessage(queuedMsg.id);
                    }}
                  >
                    <IconTrash2Outline24 className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove from queue</TooltipContent>
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MessageQueueSection(
  props: QueuedMessagesSectionProps,
): StatusCardSection | null {
  if (props.queuedMessages.length === 0) return null;

  return {
    key: 'message-queue',
    trigger: (isOpen: boolean) => (
      <div className="flex h-6 w-full flex-row items-center justify-between gap-2 pl-1.5 text-muted-foreground text-xs hover:text-foreground has-[button:hover]:text-muted-foreground">
        <div className="flex flex-row items-center justify-start gap-2">
          <ChevronDownIcon
            className={cn(
              'size-3 shrink-0 transition-transform duration-50',
              isOpen && 'rotate-180',
            )}
          />
          {`${props.queuedMessages.length} Queued`}
        </div>
        <Button variant="ghost" size="xs" onClick={props.onFlush}>
          Send now
          <IconArrowUpOutline24 className="size-3" />
        </Button>
      </div>
    ),
    contentClassName: 'px-0',
    content: (
      <AttachmentMetadataProvider messages={props.queuedMessages}>
        <MessageQueueSectionContent {...props} />
      </AttachmentMetadataProvider>
    ),
  };
}

export function StatusCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  // Use ref to persist previousHeight across effect re-runs (fixes flickering)
  const previousHeightRef = useRef(0);
  const [openAgentId] = useOpenAgent();
  const toolbox = useKartonState((s) => s.toolbox);
  const pendingDiffs = useMemo(() => {
    return toolbox[openAgentId]?.pendingFileDiffs;
  }, [toolbox, openAgentId]);
  const diffSummary = useMemo(() => {
    return toolbox[openAgentId]?.editSummary;
  }, [toolbox, openAgentId]);

  const rejectAllPendingEdits = useKartonProcedure(
    (p) => p.toolbox.rejectHunks,
  );
  const acceptAllPendingEdits = useKartonProcedure(
    (p) => p.toolbox.acceptHunks,
  );
  const createTab = useKartonProcedure((p) => p.browser.createTab);

  const messageQueue = useKartonState(
    (s) => s.agents.instances[openAgentId]?.state.queuedMessages,
  );

  // Procedure to remove a queued message
  const deleteQueuedMessage = useKartonProcedure(
    (p) => p.agents.deleteQueuedMessage,
  );

  // Procedure to send a queued message immediately (aborts current work)
  const flushQueue = useKartonProcedure((p) => p.agents.flushQueue);

  const openDiffReviewPage = useCallback(
    (fileId: string) => {
      if (!openAgentId) return;
      const fragment = fileId ? `#${encodeURIComponent(fileId)}` : '';
      void createTab(
        `stagewise://internal/diff-review/${openAgentId}${fragment}`,
        true,
      );
    },
    [openAgentId, createTab],
  );

  function formatFileDiff(fileDiff: FileDiff): FormattedFileDiff {
    const diff =
      fileDiff.isExternal === true
        ? diffLines('', '')
        : diffLines(fileDiff.baseline, fileDiff.current);
    const fileName = fileDiff.path.split('/').pop() ?? '';
    const linesAdded = diff.reduce(
      (acc, line) => acc + (line.added ? line.count : 0),
      0,
    );
    const linesRemoved = diff.reduce(
      (acc, line) => acc + (line.removed ? line.count : 0),
      0,
    );
    const hunkIds =
      fileDiff.isExternal === true
        ? [fileDiff.hunkId]
        : fileDiff.hunks.map((hunk) => hunk.id);
    return {
      fileId: fileDiff.fileId,
      path: fileDiff.path,
      fileName,
      linesAdded,
      linesRemoved,
      hunkIds,
    };
  }

  const formattedPendingDiffs = useMemo(() => {
    const edits: FormattedFileDiff[] = [];
    for (const edit of pendingDiffs ?? []) edits.push(formatFileDiff(edit));

    return edits;
  }, [pendingDiffs]);

  const formattedDiffSummary = useMemo(() => {
    const edits: FormattedFileDiff[] = [];
    for (const edit of diffSummary ?? []) edits.push(formatFileDiff(edit));

    return edits;
  }, [diffSummary]);

  // Create status card items
  const items = useMemo(() => {
    const result: StatusCardSection[] = [];

    const messageQueueSection = MessageQueueSection({
      queuedMessages: messageQueue ?? [],
      onRemoveMessage: async (messageId) =>
        await deleteQueuedMessage(openAgentId, messageId),
      onFlush: async () => await flushQueue(openAgentId),
    });
    if (messageQueueSection) result.push(messageQueueSection);

    const fileDiffSection = FileDiffSection({
      pendingDiffs: formattedPendingDiffs,
      diffSummary: formattedDiffSummary,
      onRejectAll: (hunkIds: string[]) => void rejectAllPendingEdits(hunkIds),
      onAcceptAll: (hunkIds: string[]) => void acceptAllPendingEdits(hunkIds),
      onOpenDiffReview: openDiffReviewPage,
    });
    if (fileDiffSection) result.push(fileDiffSection);

    return result;
  }, [
    messageQueue,
    openAgentId,
    deleteQueuedMessage,
    flushQueue,
    formattedPendingDiffs,
    formattedDiffSummary,
    rejectAllPendingEdits,
    acceptAllPendingEdits,
    openDiffReviewPage,
  ]);

  // Sync card height with CSS variable for ChatHistory padding
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    // Set initial height immediately (no event dispatch - just CSS update)
    const hasContent = items.length > 0;
    const initialHeight = hasContent ? card.offsetHeight : 0;
    document.documentElement.style.setProperty(
      '--status-card-height',
      `${initialHeight}px`,
    );
    previousHeightRef.current = initialHeight;

    // Only dispatch events on actual resize changes (not initial mount)
    const resizeObserver = new ResizeObserver(() => {
      const height = hasContent ? card.offsetHeight : 0;

      document.documentElement.style.setProperty(
        '--status-card-height',
        `${height}px`,
      );

      previousHeightRef.current = height;
    });
    resizeObserver.observe(card);

    return () => {
      resizeObserver.disconnect();
      document.documentElement.style.setProperty('--status-card-height', '0px');
    };
  }, [items.length]);

  if (items.length === 0) return null;

  return <StatusCardComponent items={items} ref={cardRef} />;
}
