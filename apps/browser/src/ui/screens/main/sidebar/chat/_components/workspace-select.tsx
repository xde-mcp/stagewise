import { Select, type SelectItem } from '@stagewise/stage-ui/components/select';
import {
  IconPlusFill18,
  IconChevronDownFill18,
  IconXmarkFill18,
} from 'nucleo-ui-fill-18';
import { IconFolderContent2FillDuo18 } from 'nucleo-ui-fill-duo-18';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@stagewise/stage-ui/components/tooltip';
import { cn } from '@stagewise/stage-ui/lib/utils';

import { useKartonProcedure, useKartonState } from '@/hooks/use-karton';
import { useOpenAgent } from '@/hooks/use-open-chat';
import { useMemo, useCallback, useState } from 'react';
import { Button } from '@stagewise/stage-ui/components/button';
import TimeAgo from 'react-timeago';
import buildFormatter from 'react-timeago/lib/formatters/buildFormatter';

interface WorkspaceSelectProps {
  onWorkspaceChange?: () => void;
}

export function WorkspaceSelect({ onWorkspaceChange }: WorkspaceSelectProps) {
  const [openAgent] = useOpenAgent();
  const [isHoveringDisconnect, setIsHoveringDisconnect] = useState(false);
  const selectedWorkspace = useKartonState((s) =>
    openAgent ? s.toolbox[openAgent]?.workspace?.path : null,
  );
  const recentlyOpenedWorkspaces = useKartonState(
    (s) => s.userExperience.storedExperienceData.recentlyOpenedWorkspaces,
  );
  const openWorkspace = useKartonProcedure((p) => p.toolbox.openWorkspace);
  const closeWorkspace = useKartonProcedure((p) => p.toolbox.closeWorkspace);

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

  const menuItems = useMemo((): SelectItem[] => {
    const items: SelectItem[] = [];

    // Recent workspaces (max 3, sorted by most recent, excluding current)
    const sortedWorkspaces = [...recentlyOpenedWorkspaces]
      .filter((w) => w.path !== selectedWorkspace)
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
        group: 'Recent workspaces',
      });
    }

    // Connect a new workspace option
    items.push({
      value: 'open-folder',
      label: (
        <span className="flex items-center gap-1.5 text-muted-foreground group-hover/item:text-foreground">
          <IconPlusFill18 className="size-3.5" />
          <span>Connect a new workspace</span>
        </span>
      ),
      group: 'Recent workspaces',
    });

    return items;
  }, [selectedWorkspace, recentlyOpenedWorkspaces, minimalFormatter]);

  const handleMenuSelect = useCallback(
    (value: string | null) => {
      if (!value || !openAgent) return;

      if (value.startsWith('workspace:')) {
        const path = value.replace('workspace:', '');
        void openWorkspace(openAgent, path);
        onWorkspaceChange?.();
      } else if (value === 'open-folder') {
        void openWorkspace(openAgent, undefined);
        onWorkspaceChange?.();
      }
    },
    [openAgent, openWorkspace, onWorkspaceChange],
  );

  const handleDisconnect = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsHoveringDisconnect(false);
      if (openAgent) {
        void closeWorkspace(openAgent);
        onWorkspaceChange?.();
      }
    },
    [openAgent, closeWorkspace, onWorkspaceChange],
  );

  const handleOpenChange = useCallback((open: boolean) => {
    // Reset hover state when popup opens/closes to prevent stuck state
    if (open) {
      setIsHoveringDisconnect(false);
    }
  }, []);

  if (!openAgent) return null;

  // Get display name from path (last segment)
  const displayName = selectedWorkspace
    ? selectedWorkspace.split('/').pop() || selectedWorkspace
    : 'Connect workspace';

  return (
    <Select
      items={menuItems}
      value={null}
      onValueChange={handleMenuSelect}
      onOpenChange={handleOpenChange}
      side="top"
      sideOffset={8}
      popupClassName="max-w-64"
      size="xs"
      showItemIndicator={false}
      customTrigger={(triggerProps) => (
        <Button
          {...triggerProps}
          variant="ghost"
          size="xs"
          className="group/ws-trigger min-w-0 max-w-48 px-1.5"
        >
          {selectedWorkspace && (
            <IconFolderContent2FillDuo18
              className={cn(
                'size-3.5 shrink-0',
                isHoveringDisconnect && 'text-muted-foreground',
              )}
            />
          )}
          <span
            className={cn(
              'min-w-0 truncate text-xs',
              isHoveringDisconnect && 'text-muted-foreground',
            )}
          >
            {displayName}
          </span>
          {selectedWorkspace ? (
            <Tooltip>
              <TooltipTrigger>
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={handleDisconnect}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onMouseEnter={() => setIsHoveringDisconnect(true)}
                  onMouseLeave={() => setIsHoveringDisconnect(false)}
                  className="relative size-3 shrink-0 overflow-hidden"
                >
                  {/* Chevron - hidden on button hover */}
                  <IconChevronDownFill18 className="size-3 group-hover/ws-trigger:opacity-0" />
                  {/* X icon - shown on button hover, highlighted on direct hover */}
                  <IconXmarkFill18
                    className={cn(
                      'absolute inset-0 size-3 opacity-0 group-hover/ws-trigger:opacity-100',
                      isHoveringDisconnect && 'text-foreground',
                    )}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>Disconnect workspace</TooltipContent>
            </Tooltip>
          ) : (
            <IconPlusFill18 className="size-3.5 shrink-0" />
          )}
        </Button>
      )}
    />
  );
}
