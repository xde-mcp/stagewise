import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useComparingSelector,
  useKartonProcedure,
  useKartonState,
} from '@/hooks/use-karton';
import { useOpenAgent } from '@/hooks/use-open-chat';
import { AgentTypes } from '@shared/karton-contracts/ui/agent';
import { Button } from '@stagewise/stage-ui/components/button';
import { IconPlusFill18 } from 'nucleo-ui-fill-18';
import { extractTipTapText, firstWords } from '@/utils/text-utils';
import { AgentCard } from './_components/agent-card';
import { getToolActivityLabel } from './_utils/tool-label';

type ActiveAgentCardData = {
  id: string;
  title: string;
  isWorking: boolean;
  activityText: string;
  activityIsUserInput: boolean;
  hasError: boolean;
  lastMessageAt: number;
  messageCount: number;
};

function activeAgentCardsEqual(
  a: ActiveAgentCardData[],
  b: ActiveAgentCardData[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    if (
      ai.id !== bi.id ||
      ai.title !== bi.title ||
      ai.isWorking !== bi.isWorking ||
      ai.activityText !== bi.activityText ||
      ai.activityIsUserInput !== bi.activityIsUserInput ||
      ai.hasError !== bi.hasError ||
      ai.lastMessageAt !== bi.lastMessageAt ||
      ai.messageCount !== bi.messageCount
    )
      return false;
  }
  return true;
}

/**
 * Derive a short preview from the last assistant text output.
 * Returns the first 10 words of the most recent text part.
 * Reasoning parts show "Thinking…" instead of their content.
 * Falls back to user input draft or last sent user message.
 */
function deriveActivityText(
  history: { role: string; parts: { type: string; text?: string }[] }[],
  inputState: string,
): { text: string; isUserInput: boolean } {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== 'assistant') continue;
    const parts = msg.parts;
    for (let j = parts.length - 1; j >= 0; j--) {
      const part = parts[j];
      if (part.type === 'reasoning')
        return { text: 'Thinking…', isUserInput: false };
      if (part.type === 'text') {
        const snippet = firstWords(part.text ?? '', 10);
        if (snippet) return { text: snippet, isUserInput: false };
        continue;
      }
      if (part.type.startsWith('tool-')) {
        return { text: getToolActivityLabel(part.type), isUserInput: false };
      }
    }
    break;
  }

  // Fall back to persisted input draft (already plain text, skip markdown stripping)
  if (inputState) {
    const draftText = extractTipTapText(inputState).trim();
    if (draftText) {
      const snippet = firstWords(draftText, 10, false);
      if (snippet) return { text: snippet, isUserInput: true };
    }
  }

  // Fall back to last user message preview
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== 'user') continue;
    for (let j = msg.parts.length - 1; j >= 0; j--) {
      const part = msg.parts[j];
      if (part.type === 'text') {
        const snippet = firstWords(part.text ?? '', 10);
        if (snippet) return { text: snippet, isUserInput: true };
      }
    }
    break;
  }

  return { text: '', isUserInput: false };
}

export function ActiveAgentsGrid() {
  const showActiveAgents = useKartonState(
    (s) => s.preferences.sidebar?.showActiveAgents ?? true,
  );
  const [openAgent, setOpenAgent] = useOpenAgent();
  const createAgent = useKartonProcedure((p) => p.agents.create);
  const resumeAgent = useKartonProcedure((p) => p.agents.resume);
  const deleteAgent = useKartonProcedure((p) => p.agents.delete);

  const handleCreateAgent = useCallback(() => {
    void createAgent().then((id) => {
      setOpenAgent(id);
      window.dispatchEvent(new Event('sidebar-chat-panel-opened'));
    });
  }, [createAgent, setOpenAgent]);

  const agents = useKartonState(
    useComparingSelector(
      (s): ActiveAgentCardData[] =>
        Object.entries(s.agents.instances)
          .filter(([_, agent]) => agent.type === AgentTypes.CHAT)
          .map(([id, agent]) => {
            const history = agent.state.history;
            const lastMsg = history[history.length - 1];
            const activity = deriveActivityText(
              history as {
                role: string;
                parts: { type: string; text?: string }[];
              }[],
              agent.state.inputState,
            );
            return {
              id,
              title: agent.state.title,
              isWorking: agent.state.isWorking,
              activityText: activity.text,
              activityIsUserInput: activity.isUserInput,
              hasError: !!agent.state.error,
              lastMessageAt: lastMsg?.metadata?.createdAt
                ? new Date(lastMsg.metadata.createdAt).getTime()
                : 0,
              messageCount: history.length,
            };
          }),
      activeAgentCardsEqual,
    ),
  );

  // Stable ordering: agents keep their position in the list. New agents
  // (created or resumed) are appended at the end. Removed agents are pruned.
  // Uses a ref so the order persists across renders without causing re-renders.
  const orderRef = useRef<string[]>([]);
  const orderedAgents = useMemo(() => {
    const currentIds = new Set(agents.map((a) => a.id));
    // Prune removed agents
    const kept = orderRef.current.filter((id) => currentIds.has(id));
    const keptSet = new Set(kept);
    // Append new agents at the end
    for (const agent of agents) {
      if (!keptSet.has(agent.id)) kept.push(agent.id);
    }
    orderRef.current = kept;

    const byId = new Map(agents.map((a) => [a.id, a]));
    return kept.map((id) => byId.get(id)!);
  }, [agents]);

  // Tracks agents that finished working but the user hasn't clicked on yet.
  // Agents are added when isWorking transitions false, removed on click.
  const [unacknowledged, setUnacknowledged] = useState<Set<string>>(
    () => new Set(),
  );

  const handleClick = useCallback(
    (id: string) => {
      setUnacknowledged((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      void resumeAgent(id).then(() => {
        setOpenAgent(id);
      });
    },
    [resumeAgent, setOpenAgent],
  );

  const handleDelete = useCallback(
    (id: string) => {
      void deleteAgent(id);
    },
    [deleteAgent],
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  /** Scroll a card into the safe (non-masked) area of the scroll container.
   * The container has CSS mask gradients (8px top/bottom) that fade content
   * to hint at overflow. We only scroll when the card overlaps those fade
   * zones — if it's already fully visible, we leave the position alone. */
  const scrollCardIntoView = useCallback((agentId: string) => {
    const container = scrollRef.current;
    if (!container) return;
    const card = container.querySelector<HTMLElement>(
      `[data-agent-id="${agentId}"]`,
    );
    if (!card) return;

    const fadeZone = 8;
    const cRect = container.getBoundingClientRect();
    const eRect = card.getBoundingClientRect();

    if (
      eRect.top < cRect.top + fadeZone ||
      eRect.bottom > cRect.bottom - fadeZone
    ) {
      card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, []);

  // Scroll to the active card when the user switches agents.
  useEffect(() => {
    if (openAgent) scrollCardIntoView(openAgent);
  }, [openAgent, scrollCardIntoView]);

  // When an agent finishes (isWorking → false), scroll to it and mark it
  // as unacknowledged so the pulse animation plays until the user clicks it.
  const prevWorkingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const prevWorking = prevWorkingRef.current;
    const nowWorking = new Set<string>();
    const justFinished: string[] = [];

    for (const agent of agents) {
      if (agent.isWorking) nowWorking.add(agent.id);
      if (!agent.isWorking && prevWorking.has(agent.id)) {
        justFinished.push(agent.id);
        scrollCardIntoView(agent.id);
      }
    }

    if (justFinished.length > 0) {
      setUnacknowledged((prev) => {
        const next = new Set(prev);
        for (const id of justFinished) next.add(id);
        return next;
      });
    }

    prevWorkingRef.current = nowWorking;
  }, [agents, scrollCardIntoView]);

  // Only show when enabled and 2+ active CHAT agents
  if (!showActiveAgents || agents.length < 2) return null;

  return (
    <div className="flex shrink-0 flex-col border-border-subtle border-b pt-2 pl-2 group-data-[collapsed=true]:hidden">
      <div className="flex items-center justify-between pr-1.5">
        <span className="px-0.5 font-medium text-muted-foreground text-sm">
          Active agents
        </span>
        <Button
          variant="ghost"
          size="xs"
          className="-mr-1.5 shrink-0"
          onClick={handleCreateAgent}
        >
          <span>New agent</span>
          <IconPlusFill18 className="size-3" />
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="scrollbar-hover-only -mr-[2px] grid max-h-[15vh] min-h-5 auto-rows-max @[400px]:grid-cols-2 grid-cols-1 gap-2 overflow-y-auto pt-2 pb-3.5"
        style={{
          scrollbarGutter: 'stable',
          maskImage:
            'linear-gradient(to bottom, transparent, black 8px, black calc(100% - 8px), rgba(0,0,0,0.5))',
        }}
      >
        {orderedAgents.map((agent) => {
          const isOpen = agent.id === openAgent;
          const hasUnseen = !isOpen && unacknowledged.has(agent.id);

          return (
            <AgentCard
              key={agent.id}
              id={agent.id}
              title={agent.title}
              isActive={isOpen}
              isWorking={agent.isWorking}
              hasError={agent.hasError}
              hasUnseen={hasUnseen}
              activityText={agent.activityText}
              activityIsUserInput={agent.activityIsUserInput}
              lastMessageAt={agent.lastMessageAt}
              onClick={handleClick}
              onDelete={handleDelete}
            />
          );
        })}
      </div>
    </div>
  );
}
