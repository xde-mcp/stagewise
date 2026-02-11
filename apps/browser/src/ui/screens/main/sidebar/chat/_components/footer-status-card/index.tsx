import { useCallback, useMemo, useEffect, useRef } from 'react';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import type { AgentMessage } from '@shared/karton-contracts/ui/agent';
import { useOpenAgent } from '@/hooks/use-open-chat';
import {
  type StatusCardSection,
  type FormattedFileDiff,
  StatusCardComponent,
} from './shared';
import { FileDiffSection, formatFileDiff } from './file-diff-section';
import { MessageQueueSection } from './message-queue-section';

// Stable empty arrays to avoid infinite loop with useSyncExternalStore
const EMPTY_QUEUE: (AgentMessage & { role: 'user' })[] = [];

export function StatusCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  // Use ref to persist previousHeight across effect re-runs (fixes flickering)
  const previousHeightRef = useRef(0);
  const [openAgentId] = useOpenAgent();
  const toolbox = useKartonState((s) => s.toolbox);
  const pendingDiffs = useMemo(() => {
    if (!openAgentId) return [];
    return toolbox[openAgentId]?.pendingFileDiffs;
  }, [toolbox, openAgentId]);
  const diffSummary = useMemo(() => {
    if (!openAgentId) return [];
    return toolbox[openAgentId]?.editSummary;
  }, [toolbox, openAgentId]);

  const rejectAllPendingEdits = useKartonProcedure(
    (p) => p.toolbox.rejectHunks,
  );
  const acceptAllPendingEdits = useKartonProcedure(
    (p) => p.toolbox.acceptHunks,
  );
  const createTab = useKartonProcedure((p) => p.browser.createTab);

  const messageQueue = useKartonState((s) =>
    openAgentId
      ? (s.agents.instances[openAgentId]?.state.queuedMessages ?? EMPTY_QUEUE)
      : EMPTY_QUEUE,
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
      onRemoveMessage: async (messageId) => {
        if (!openAgentId) return;
        await deleteQueuedMessage(openAgentId, messageId);
      },
      onFlush: async () => {
        if (!openAgentId) return;
        await flushQueue(openAgentId);
      },
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

  return (
    <StatusCardComponent
      items={items}
      ref={cardRef as React.RefObject<HTMLDivElement>}
    />
  );
}
