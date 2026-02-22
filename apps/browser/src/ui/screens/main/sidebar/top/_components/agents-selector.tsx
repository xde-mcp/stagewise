import { Combobox as ComboboxBase } from '@base-ui/react/combobox';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
} from '@stagewise/stage-ui/components/combobox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { Button } from '@stagewise/stage-ui/components/button';
import { IconHistoryFill18 } from 'nucleo-ui-fill-18';
import { IconTrash2Outline24 } from 'nucleo-core-outline-24';
import { cn } from '@/utils';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TimeAgo from 'react-timeago';
import buildFormatter from 'react-timeago/lib/formatters/buildFormatter';

// ============================================================================
// Types
// ============================================================================

export interface AgentEntry {
  id: string;
  title: string;
  lastMessageAt: Date;
  messageCount: number;
  isWorking?: boolean;
}

export interface AgentGroup {
  label: string;
  agents: AgentEntry[];
}

export interface AgentsSelectorProps {
  groups: AgentGroup[];
  value: string | null;
  onValueChange: (id: string) => void;
  onDelete: (id: string) => void;
  onEndReached?: () => void;
  lastViewedChats: Record<string, number>;
}

// ============================================================================
// Compact time-ago formatter (module-level constant)
// ============================================================================

const minimalFormatter = buildFormatter({
  prefixAgo: '',
  prefixFromNow: '',
  suffixAgo: '',
  suffixFromNow: '',
  second: '1s',
  seconds: (value) => `${value}s`,
  minute: '1m',
  minutes: (value) => `${value}m`,
  hour: '1h',
  hours: (value) => `${value}h`,
  day: '1d',
  days: (value) => `${value}d`,
  week: '1w',
  weeks: (value) => `${value}w`,
  month: '1M',
  months: (value) => `${value}M`,
  year: '1y',
  years: (value) => `${value}y`,
  wordSeparator: '',
  numbers: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
});

// ============================================================================
// Component
// ============================================================================

export const AgentsSelector = memo(function AgentsSelector({
  groups,
  value,
  onValueChange,
  onDelete,
  onEndReached,
  lastViewedChats,
}: AgentsSelectorProps) {
  const [inputValue, setInputValue] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filter groups by search input
  const filteredGroups = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        agents: g.agents.filter((a) => a.title.toLowerCase().includes(q)),
      }))
      .filter((g) => g.agents.length > 0);
  }, [groups, inputValue]);

  const hasResults = filteredGroups.some((g) => g.agents.length > 0);

  // Infinite scroll: observe sentinel near bottom of list
  const onEndReachedRef = useRef(onEndReached);
  onEndReachedRef.current = onEndReached;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !onEndReachedRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onEndReachedRef.current?.();
      },
      { root: listRef.current, rootMargin: '0px 0px 200px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasResults]);

  const handleValueChange = useCallback(
    (v: string | null) => {
      if (v) onValueChange(v);
    },
    [onValueChange],
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      const agentId = e.currentTarget.dataset.agentId;
      if (agentId) onDelete(agentId);
    },
    [onDelete],
  );

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) setInputValue('');
  }, []);

  return (
    <Combobox
      value={value}
      onValueChange={handleValueChange}
      onInputValueChange={setInputValue}
      onOpenChange={handleOpenChange}
    >
      {/* Custom trigger: unstyled, using base-ui Trigger directly with render */}
      <ComboboxBase.Trigger
        render={(props) => (
          <Tooltip>
            <TooltipTrigger>
              <Button
                {...props}
                variant="ghost"
                size="icon-xs"
                className="app-no-drag shrink-0"
              >
                <IconHistoryFill18 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span>Show recent chats</span>
            </TooltipContent>
          </Tooltip>
        )}
      />

      <ComboboxContent
        side="bottom"
        sideOffset={8}
        size="xs"
        className="min-w-56 max-w-72"
      >
        <div className="mb-1">
          <ComboboxInput size="xs" placeholder="Search chats…" />
        </div>

        <div
          ref={listRef}
          className="scrollbar-hover-only max-h-48 overflow-y-auto"
        >
          <ComboboxList>
            {filteredGroups.map(({ label, agents }) => (
              <ComboboxGroup key={label}>
                <ComboboxGroupLabel>{label}</ComboboxGroupLabel>
                {agents.map((agent) => {
                  const lastViewedAt = lastViewedChats[agent.id] ?? 0;
                  const hasTracking = agent.id in lastViewedChats;
                  const lastMsgTime = new Date(agent.lastMessageAt).getTime();
                  const dayAgo = Date.now() - 86_400_000;
                  const isOpen = agent.id === value;
                  const hasUnseen =
                    hasTracking &&
                    !agent.isWorking &&
                    !isOpen &&
                    agent.messageCount > 0 &&
                    lastMsgTime > lastViewedAt &&
                    lastMsgTime > dayAgo;

                  return (
                    <ComboboxItem
                      key={agent.id}
                      value={agent.id}
                      size="xs"
                      className="grid-cols-[0.75rem_1fr_auto]"
                    >
                      <ComboboxItemIndicator />
                      <span className="col-start-2 flex w-full items-center gap-2">
                        <span
                          className={cn(
                            'truncate',
                            agent.isWorking && 'shimmer-text-primary',
                            hasUnseen && 'animate-text-pulse-warning',
                          )}
                        >
                          {agent.title}
                        </span>
                        <span className="shrink-0 text-subtle-foreground text-xs">
                          <TimeAgo
                            date={agent.lastMessageAt}
                            formatter={minimalFormatter}
                            live={false}
                          />
                        </span>
                      </span>
                      <button
                        type="button"
                        className="col-start-3 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground opacity-0 transition-colors hover:text-foreground group-hover/item:opacity-100"
                        data-agent-id={agent.id}
                        onClick={handleDeleteClick}
                      >
                        <IconTrash2Outline24 className="size-3" />
                      </button>
                    </ComboboxItem>
                  );
                })}
              </ComboboxGroup>
            ))}
          </ComboboxList>
          {onEndReached && (
            <div
              ref={sentinelRef}
              aria-hidden="true"
              className="h-px shrink-0"
            />
          )}
        </div>

        {!hasResults && <ComboboxEmpty />}
      </ComboboxContent>
    </Combobox>
  );
});
