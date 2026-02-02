import { WorkspaceInfoBadge } from './_components/workspace-info';
import { cn } from '@/utils';
import {
  IconDotsFill18,
  IconHistoryFill18,
  IconPlusFill18,
} from 'nucleo-ui-fill-18';
import {
  IconTrash2Outline24,
  IconGear2Outline24,
} from 'nucleo-core-outline-24';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { Button } from '@stagewise/stage-ui/components/button';
import {
  SearchableSelect,
  type SearchableSelectItem,
} from '@stagewise/stage-ui/components/searchable-select';
import { Select, type SelectItem } from '@stagewise/stage-ui/components/select';
import { useKartonProcedure, useKartonState } from '@/hooks/use-karton';
import TimeAgo from 'react-timeago';
import buildFormatter from 'react-timeago/lib/formatters/buildFormatter';
import type { ChatSummary } from '@shared/karton-contracts/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHotKeyListener } from '@/hooks/use-hotkey-listener';
import { HotkeyActions } from '@shared/hotkeys';
import { HotkeyComboText } from '@/components/hotkey-combo-text';
import { SETTINGS_PAGE_URL } from '@shared/internal-urls';
import { useChatDraft } from '@/hooks/use-chat-draft';
import { useOpenAgent } from '@/hooks/use-open-chat';

export function SidebarTopSection({ isCollapsed }: { isCollapsed: boolean }) {
  const createAgent = useKartonProcedure((p) => p.agents.create);
  const deleteChat = useKartonProcedure((p) => p.agents.delete);
  const getAgentsList = useKartonProcedure((p) => p.agents.getAgentsList);
  const platform = useKartonState((s) => s.appInfo.platform);
  const isFullScreen = useKartonState((s) => s.appInfo.isFullScreen);
  const [openAgent, setOpenAgent] = useOpenAgent();

  const createTab = useKartonProcedure((p) => p.browser.createTab);
  const openWorkspace = useKartonProcedure((p) => p.workspace.open);

  // Workspace state
  const workspaceStatus = useKartonState((s) => s.workspaceStatus);
  const workspaceConnected = workspaceStatus === 'open';
  const recentlyOpenedWorkspaces = useKartonState(
    (s) => s.userExperience.storedExperienceData.recentlyOpenedWorkspaces,
  );

  // Tick every minute to refresh time-ago labels and groupings
  const [timeTick, setTimeTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTimeTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const [agentsList, setAgentsList] = useState<
    Awaited<ReturnType<typeof getAgentsList>>
  >([]);
  useEffect(() => {
    void getAgentsList(0, 200).then(setAgentsList);
    // TODO: Later, we can add pagination...
  }, []);

  const showChatListButton = useMemo(() => {
    return agentsList.length > 1;
  }, [agentsList]);

  const showNewChatButton = useMemo(() => {
    return openAgent !== null;
  }, [openAgent]);

  const groupedChats = useMemo(() => {
    // Sort by updatedAt descending so most recent chats appear first
    const sorted = [...agentsList].sort(
      (a, b) =>
        new Date(b.lastMessageTimestamp).getTime() -
        new Date(a.lastMessageTimestamp).getTime(),
    );
    return groupChatsByTime(sorted);
  }, [agentsList, timeTick]);

  const minimalFormatter = useMemo(
    () =>
      buildFormatter({
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
      }),
    [],
  );

  // Get draft getter from context (provided by panel-footer)
  const { getDraft } = useChatDraft();

  // Convert grouped chats to flat items with group property for SearchableSelect
  const chatSelectItems = useMemo((): SearchableSelectItem[] => {
    const items: SearchableSelectItem[] = [];
    for (const [label, groupChats] of Object.entries(groupedChats)) {
      for (const chat of groupChats) {
        items.push({
          value: chat.id,
          label: (
            <span className="flex w-full items-center gap-2">
              <span className="truncate">{chat.title}</span>
              <span className="shrink-0 text-subtle-foreground text-xs">
                <TimeAgo
                  date={chat.updatedAt}
                  formatter={minimalFormatter}
                  live={false}
                />
              </span>
            </span>
          ),
          searchText: chat.title,
          group: label,
          action: {
            icon: <IconTrash2Outline24 className="size-3" />,
            onClick: (value, e) => {
              e.stopPropagation();
              void deleteChat(value);
              setAgentsList(agentsList.filter((agent) => agent.id !== value));
            },
            showOnHover: true,
          },
        });
      }
    }
    // Add "Load more" item if there are more chats available
    if (agentsList.length % 200 === 0) {
      items.push({
        value: '__load_more__',
        label: (
          <span className="text-muted-foreground text-xs">Load more...</span>
        ),
        searchText: '',
        group: '',
      });
    }
    return items;
  }, [groupedChats, deleteChat, minimalFormatter]);

  // Helper to create a new chat and focus the input
  const createAgentAndFocus = useCallback(async () => {
    await createAgent();
    void getAgentsList(0, 200).then(setAgentsList);
    window.dispatchEvent(new Event('sidebar-chat-panel-opened'));
  }, [createAgent, getAgentsList]);

  // Hotkey: CTRL+N to create new agent chat (disabled when agent is working)
  useHotKeyListener(() => {
    if (showNewChatButton) void createAgentAndFocus();
  }, HotkeyActions.CTRL_N);

  const handleChatSelect = useCallback(
    (value: string | null) => {
      if (!value) return;
      if (value === '__load_more__') {
        void getAgentsList(agentsList.length, 200).then((res) => {
          setAgentsList([...agentsList, ...res]);
        });
        return;
      }
      if (value !== openAgent) {
        setOpenAgent(value);
      }
    },
    [openAgent, setOpenAgent, getDraft],
  );

  // Build menu items for the options dropdown
  const menuItems = useMemo((): SelectItem[] => {
    const items: SelectItem[] = [];

    // Show workspace options when not connected
    if (!workspaceConnected) {
      // Add recent workspaces (max 3, sorted by most recent)
      const sortedWorkspaces = [...recentlyOpenedWorkspaces]
        .sort((a, b) => b.openedAt - a.openedAt)
        .slice(0, 3);

      for (const workspace of sortedWorkspaces) {
        items.push({
          value: `workspace:${workspace.path}`,
          label: (
            <span className="flex w-full items-baseline gap-2">
              <span className="truncate">{workspace.name}</span>
              <span className="shrink-0 text-subtle-foreground text-xs">
                <TimeAgo
                  date={workspace.openedAt}
                  formatter={minimalFormatter}
                  live={false}
                />
              </span>
            </span>
          ),
          description: (
            <span className="truncate text-subtle-foreground" dir="rtl">
              <span dir="ltr">{workspace.path}</span>
            </span>
          ),
          group: 'Connected workspaces',
        });
      }

      // Add "Connect a new workspace" option
      items.push({
        value: 'open-folder',
        label: (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <IconPlusFill18 className="size-3.5" />
            <span>Connect a new workspace</span>
          </span>
        ),
        group: 'Connected workspaces',
      });
    }

    // Always show Settings under General
    items.push({
      value: 'settings',
      label: (
        <span className="flex items-center gap-1.5">
          <IconGear2Outline24 className="size-3.5 text-muted-foreground" />
          <span>Settings</span>
        </span>
      ),
      group: 'General',
    });

    return items;
  }, [workspaceConnected, recentlyOpenedWorkspaces, minimalFormatter]);

  // Handle menu selection
  const handleMenuSelect = useCallback(
    (value: string | null) => {
      if (!value) return;

      if (value.startsWith('workspace:')) {
        const path = value.replace('workspace:', '');
        void openWorkspace(path);
      } else if (value === 'open-folder') void openWorkspace(undefined);
      else if (value === 'settings') createTab(SETTINGS_PAGE_URL, true);
    },
    [openWorkspace, createTab],
  );

  return (
    <div
      className={cn(
        'app-drag flex h-7 flex-row items-center justify-start gap-2 border-border-subtle border-b pb-1 group-data-[collapsed=true]:hidden',
        platform === 'darwin' && !isFullScreen ? 'pl-18' : 'ml-0',
      )}
    >
      {!isCollapsed && <WorkspaceInfoBadge />}
      <div className="flex-1 shrink-0 group-data-[collapsed=true]:hidden" />
      {!isCollapsed && (
        <div className="@[240px]:flex hidden shrink-0 flex-row items-center">
          {showNewChatButton && (
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0"
                  onClick={() => void createAgentAndFocus()}
                >
                  <IconPlusFill18 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span>
                  Create new chat (
                  <HotkeyComboText action={HotkeyActions.CTRL_N} />)
                </span>
              </TooltipContent>
            </Tooltip>
          )}
          {showChatListButton && (
            <SearchableSelect
              items={chatSelectItems}
              value={openAgent}
              onValueChange={handleChatSelect}
              side="bottom"
              sideOffset={8}
              size="xs"
              customTrigger={(triggerProps) => (
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      {...triggerProps}
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
          )}
          <Select
            items={menuItems}
            value={null}
            onValueChange={handleMenuSelect}
            side="bottom"
            sideOffset={8}
            popupClassName="max-w-64"
            size="xs"
            showItemIndicator={false}
            customTrigger={(triggerProps) => (
              <Tooltip>
                <TooltipTrigger>
                  <Button
                    {...triggerProps}
                    variant="ghost"
                    size="icon-xs"
                    className="app-no-drag shrink-0"
                  >
                    <IconDotsFill18 className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <span>More options</span>
                </TooltipContent>
              </Tooltip>
            )}
          />
        </div>
      )}
    </div>
  );
}

type TimeAgoLabel = string;

/**
 * Groups chat summaries by time labels (Today, Yesterday, etc.)
 * @param chatList The chat summaries to group (already sorted by updatedAt desc)
 * @returns Grouped chats by time label, each group containing an array of ChatSummary
 */
function groupChatsByTime(
  agentsList: {
    id: string;
    title: string;
    createdAt: Date;
    lastMessageTimestamp: Date;
  }[],
): Record<TimeAgoLabel, ChatSummary[]> {
  // Helper function to get time label for a chat
  // Uses calendar-day boundaries (midnight in user's timezone) instead of
  // absolute time differences for more intuitive "Yesterday" grouping
  function getTimeLabel(date: Date): string {
    const now = new Date();
    const chatDate = new Date(date);

    // Get start of today (midnight) in user's local timezone
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    // Calculate calendar days ago (based on midnight boundaries)
    const diffFromTodayStart = todayStart.getTime() - chatDate.getTime();
    const calendarDaysAgo = Math.ceil(
      diffFromTodayStart / (1000 * 60 * 60 * 24),
    );

    // Daily grouping (0-7 days)
    if (calendarDaysAgo <= 0) return 'Today'; // chatDate >= todayStart
    if (calendarDaysAgo === 1) return 'Yesterday';
    if (calendarDaysAgo >= 2 && calendarDaysAgo <= 7)
      return `${calendarDaysAgo} days ago`;

    // Weekly grouping (8-29 days)
    if (calendarDaysAgo < 30) {
      const weeksAgo = Math.floor(calendarDaysAgo / 7);
      return weeksAgo === 1 ? 'last week' : `${weeksAgo} weeks ago`;
    }

    // Monthly grouping (30 days to 1 year)
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    const chatYear = chatDate.getFullYear();
    const chatMonth = chatDate.getMonth();

    const monthsDiff = (nowYear - chatYear) * 12 + (nowMonth - chatMonth);

    if (monthsDiff < 12)
      return monthsDiff === 1 ? 'Last month' : `${monthsDiff} months ago`;

    // Yearly grouping (1+ years)
    const yearsDiff = nowYear - chatYear;
    return yearsDiff === 1 ? '1 year ago' : `${yearsDiff} years ago`;
  }

  // Group chats by time label (chatList is already sorted by updatedAt desc)
  const grouped: Record<string, ChatSummary[]> = {};

  for (const agent of agentsList) {
    const label = getTimeLabel(agent.lastMessageTimestamp);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push({
      id: agent.id,
      title: agent.title,
      createdAt: new Date(),
      updatedAt: agent.lastMessageTimestamp,
    });
  }

  return grouped;
}
