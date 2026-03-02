import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import {
  useKartonState,
  useKartonProcedure,
  useComparingSelector,
} from '@/hooks/use-karton';
import {
  AgentTypes,
  type AgentMessage,
} from '@shared/karton-contracts/ui/agent';
import { EMPTY_MOUNTS } from '@shared/karton-contracts/ui';
import { useOpenAgent } from '@/hooks/use-open-chat';
import {
  type StatusCardSection,
  type FormattedFileDiff,
  StatusCardComponent,
} from './shared';
import { FileDiffSection, formatFileDiff } from './file-diff-section';
import { MessageQueueSection } from './message-queue-section';
import {
  WorkspaceMdStatusSection,
  type WorkspaceMdStatus,
} from './workspace-md-section';
import { UserQuestionSection } from './user-question-section';
import { getBaseName } from '@shared/path-utils';

// Stable empty arrays to avoid infinite loop with useSyncExternalStore
const EMPTY_HISTORY: AgentMessage[] = [];
const EMPTY_QUEUE: (AgentMessage & { role: 'user' })[] = [];

type WorkspaceMdAgentEntry = {
  agentId: string;
  workspacePath: string;
  isWorking: boolean;
  error?: { code?: number; message: string; stack?: string };
};

function compareAgentEntries(
  a: WorkspaceMdAgentEntry[],
  b: WorkspaceMdAgentEntry[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].agentId !== b[i].agentId ||
      a[i].workspacePath !== b[i].workspacePath ||
      a[i].isWorking !== b[i].isWorking ||
      a[i].error !== b[i].error
    )
      return false;
  }
  return true;
}

export function StatusCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const previousHeightRef = useRef(0);
  const [openAgentId] = useOpenAgent();
  const pendingDiffs = useKartonState((s) =>
    openAgentId ? s.toolbox[openAgentId]?.pendingFileDiffs : undefined,
  );
  const diffSummary = useKartonState((s) =>
    openAgentId ? s.toolbox[openAgentId]?.editSummary : undefined,
  );

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

  const workspaceMounts = useKartonState((s) =>
    openAgentId
      ? (s.toolbox[openAgentId]?.workspace?.mounts ?? EMPTY_MOUNTS)
      : EMPTY_MOUNTS,
  );

  const generateWorkspaceMd = useKartonProcedure(
    (p) => p.toolbox.generateWorkspaceMd,
  );
  const stopAgent = useKartonProcedure((p) => p.agents.stop);

  // All workspace-md agent instances with their workspace paths
  const workspaceMdAgents = useKartonState(
    useComparingSelector((s): WorkspaceMdAgentEntry[] => {
      const entries: WorkspaceMdAgentEntry[] = [];
      for (const agentId in s.agents.instances) {
        const inst = s.agents.instances[agentId];
        if (inst.type !== AgentTypes.WORKSPACE_MD) continue;
        const path = s.toolbox[agentId]?.workspace?.mounts?.[0]?.path;
        if (!path) continue;
        entries.push({
          agentId,
          workspacePath: path,
          isWorking: inst.state.isWorking,
          error: inst.state.error,
        });
      }
      return entries;
    }, compareAgentEntries),
  );

  // Histories for workspace-md agents (selected as frozen subtree refs)
  const workspaceMdHistoriesByAgentId = useKartonState(
    useComparingSelector((s) => {
      const map: Record<string, AgentMessage[]> = {};
      for (const agentId in s.agents.instances) {
        const inst = s.agents.instances[agentId];
        if (inst.type !== AgentTypes.WORKSPACE_MD) continue;
        map[agentId] = inst.state.history;
      }
      return map;
    }),
  );

  // Per-workspace-path local state for lifecycle tracking
  const [dismissedPaths, setDismissedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [completedPaths, setCompletedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [errorsByPath, setErrorsByPath] = useState<Map<string, string>>(
    () => new Map(),
  );
  const prevAgentStatesRef = useRef<Map<string, boolean>>(new Map());
  const stoppedByUserRef = useRef<Set<string>>(new Set());

  // Detect running→stopped transitions per agent and update local state
  useEffect(() => {
    const prev = prevAgentStatesRef.current;
    const next = new Map<string, boolean>();

    for (const agent of workspaceMdAgents) {
      next.set(agent.agentId, agent.isWorking);
      const wasWorking = prev.get(agent.agentId) ?? false;

      if (wasWorking && !agent.isWorking) {
        const userStopped = stoppedByUserRef.current.has(agent.agentId);
        stoppedByUserRef.current.delete(agent.agentId);

        if (agent.error) {
          setErrorsByPath((m) => {
            const copy = new Map(m);
            copy.set(agent.workspacePath, agent.error!.message);
            return copy;
          });
        } else if (!userStopped) {
          const mount = workspaceMounts.find(
            (m) => m.path === agent.workspacePath,
          );
          if (mount?.workspaceMdContent !== null) {
            setCompletedPaths((s) => {
              const copy = new Set(s);
              copy.add(agent.workspacePath);
              return copy;
            });
          }
        }
      }
    }

    prevAgentStatesRef.current = next;
  }, [workspaceMdAgents, workspaceMounts]);

  // Show file callback - navigates to agent settings, optionally targeting a specific workspace
  const handleShowFile = useCallback(
    (workspacePath?: string) => {
      const params = workspacePath
        ? `?workspace=${encodeURIComponent(workspacePath)}`
        : '';
      void createTab(`stagewise://internal/agent-settings${params}`, true);
    },
    [createTab],
  );

  // Procedure to remove a queued message
  const deleteQueuedMessage = useKartonProcedure(
    (p) => p.agents.deleteQueuedMessage,
  );

  // Procedure to send a queued message immediately (aborts current work)
  const flushQueue = useKartonProcedure((p) => p.agents.flushQueue);

  const pendingUserQuestion = useKartonState((s) =>
    openAgentId ? (s.toolbox[openAgentId]?.pendingUserQuestion ?? null) : null,
  );

  const submitUserQuestionStep = useKartonProcedure(
    (p) => p.toolbox.submitUserQuestionStep,
  );
  const cancelUserQuestion = useKartonProcedure(
    (p) => p.toolbox.cancelUserQuestion,
  );
  const goBackUserQuestion = useKartonProcedure(
    (p) => p.toolbox.goBackUserQuestion,
  );

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

  // Build workspace-md sections — one per mount
  const workspaceMdSections = useMemo(() => {
    const sections: StatusCardSection[] = [];

    // Build lookup: workspacePath → agent entry
    const agentByPath = new Map<string, WorkspaceMdAgentEntry>();
    for (const agent of workspaceMdAgents) {
      const existing = agentByPath.get(agent.workspacePath);
      if (!existing || agent.isWorking) {
        agentByPath.set(agent.workspacePath, agent);
      }
    }

    for (const mount of workspaceMounts) {
      const agent = agentByPath.get(mount.path);
      const folderName = getBaseName(mount.path) || mount.path;

      let status: WorkspaceMdStatus;
      let errorMessage: string | null = null;
      let history: AgentMessage[] = EMPTY_HISTORY;

      if (agent?.isWorking) {
        status = 'running';
        history = workspaceMdHistoriesByAgentId[agent.agentId] ?? EMPTY_HISTORY;
      } else if (completedPaths.has(mount.path)) {
        status = 'completed';
      } else if (errorsByPath.has(mount.path)) {
        status = 'error';
        errorMessage = errorsByPath.get(mount.path) ?? null;
      } else if (
        mount.workspaceMdContent === null &&
        !dismissedPaths.has(mount.path)
      ) {
        status = 'prompt';
      } else {
        continue;
      }

      const mountPath = mount.path;
      const mountPrefix = mount.prefix;
      const agentId = agent?.agentId;

      const section = WorkspaceMdStatusSection({
        status,
        sectionKey: `workspace-md-${mountPath}`,
        workspaceName: folderName,
        history,
        errorMessage,
        onDismiss: () => {
          if (status === 'prompt') {
            setDismissedPaths((s) => {
              const copy = new Set(s);
              copy.add(mountPath);
              return copy;
            });
          }
          setCompletedPaths((s) => {
            if (!s.has(mountPath)) return s;
            const copy = new Set(s);
            copy.delete(mountPath);
            return copy;
          });
          setErrorsByPath((m) => {
            if (!m.has(mountPath)) return m;
            const copy = new Map(m);
            copy.delete(mountPath);
            return copy;
          });
        },
        onShowFile: () => handleShowFile(mountPath),
        onGenerate: () => {
          if (!openAgentId) return;
          setErrorsByPath((m) => {
            if (!m.has(mountPath)) return m;
            const copy = new Map(m);
            copy.delete(mountPath);
            return copy;
          });
          void generateWorkspaceMd(openAgentId, mountPrefix);
        },
        onStop: agentId
          ? () => {
              stoppedByUserRef.current.add(agentId);
              void stopAgent(agentId);
            }
          : undefined,
      });
      if (section) sections.push(section);
    }

    return sections;
  }, [
    workspaceMounts,
    workspaceMdAgents,
    workspaceMdHistoriesByAgentId,
    dismissedPaths,
    completedPaths,
    errorsByPath,
    handleShowFile,
    openAgentId,
    generateWorkspaceMd,
    stopAgent,
  ]);

  // Create status card items
  const items = useMemo(() => {
    const result: StatusCardSection[] = [];

    for (const section of workspaceMdSections) {
      result.push(section);
    }

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

    const userQuestionSection = UserQuestionSection({
      pendingQuestion: pendingUserQuestion,
      onSubmitStep: async (questionId, answers) => {
        if (!openAgentId) return;
        await submitUserQuestionStep(openAgentId, questionId, answers);
      },
      onCancel: async (questionId) => {
        if (!openAgentId) return;
        await cancelUserQuestion(openAgentId, questionId, 'user_cancelled');
      },
      onGoBack: async (questionId) => {
        if (!openAgentId) return;
        await goBackUserQuestion(openAgentId, questionId);
      },
    });
    if (userQuestionSection) result.push(userQuestionSection);

    return result;
  }, [
    workspaceMdSections,
    messageQueue,
    openAgentId,
    deleteQueuedMessage,
    flushQueue,
    formattedPendingDiffs,
    formattedDiffSummary,
    rejectAllPendingEdits,
    acceptAllPendingEdits,
    openDiffReviewPage,
    pendingUserQuestion,
    submitUserQuestionStep,
    cancelUserQuestion,
    goBackUserQuestion,
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
