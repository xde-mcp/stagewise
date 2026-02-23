import { Select, type SelectItem } from '@stagewise/stage-ui/components/select';
import { IconPlusFill18, IconXmarkFill18 } from 'nucleo-ui-fill-18';
import { IconFolderContent2FillDuo18 } from 'nucleo-ui-fill-duo-18';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@stagewise/stage-ui/components/tooltip';
import { cn } from '@stagewise/stage-ui/lib/utils';

import { useKartonProcedure, useKartonState } from '@/hooks/use-karton';
import { useOpenAgent } from '@/hooks/use-open-chat';
import { useMemo, useCallback } from 'react';
import TimeAgo from 'react-timeago';
import buildFormatter from 'react-timeago/lib/formatters/buildFormatter';

const EMPTY_MOUNTS: Array<{ prefix: string; path: string }> = [];

interface WorkspaceSelectProps {
  onWorkspaceChange?: () => void;
}

export function WorkspaceSelect({ onWorkspaceChange }: WorkspaceSelectProps) {
  const [openAgent] = useOpenAgent();

  const recentlyOpenedWorkspaces = useKartonState(
    (s) => s.userExperience.storedExperienceData.recentlyOpenedWorkspaces,
  );
  const mountWorkspace = useKartonProcedure((p) => p.toolbox.mountWorkspace);
  const unmountWorkspace = useKartonProcedure(
    (p) => p.toolbox.unmountWorkspace,
  );
  const allMounts = useKartonState((s) =>
    openAgent
      ? (s.toolbox[openAgent]?.workspace?.mounts ?? EMPTY_MOUNTS)
      : EMPTY_MOUNTS,
  );

  const hasMounts = allMounts.length > 0;

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

  // Only recent (non-mounted) workspaces in the popover
  const menuItems = useMemo((): SelectItem[] => {
    const items: SelectItem[] = [];

    const mountedPaths = new Set(allMounts.map((m) => m.path));
    const sortedWorkspaces = [...recentlyOpenedWorkspaces]
      .filter((w) => !mountedPaths.has(w.path))
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

    items.push({
      value: 'open-folder',
      label: (
        <span className="flex items-center gap-1.5 text-muted-foreground group-hover/item:text-foreground">
          <IconPlusFill18 className="size-3.5" />
          <span>Mount a new workspace</span>
        </span>
      ),
      group: 'Recent workspaces',
    });

    return items;
  }, [allMounts, recentlyOpenedWorkspaces, minimalFormatter]);

  const handleMenuSelect = useCallback(
    (value: string | null) => {
      if (!value || !openAgent) return;

      if (value.startsWith('workspace:')) {
        const path = value.replace('workspace:', '');
        void mountWorkspace(openAgent, path);
        onWorkspaceChange?.();
      } else if (value === 'open-folder') {
        void mountWorkspace(openAgent, undefined);
        onWorkspaceChange?.();
      }
    },
    [openAgent, mountWorkspace, onWorkspaceChange],
  );

  const renderItem = useCallback((item: SelectItem) => {
    const isRecent = String(item.value).startsWith('workspace:');
    const hasDescription = !!item.description;

    if (isRecent) {
      const path = String(item.value).replace('workspace:', '');
      const name = path.split('/').pop() || path;
      return (
        <Tooltip>
          <TooltipTrigger>
            <div className="flex w-full cursor-pointer flex-col">
              <div
                className={cn(
                  'flex flex-col transition-[mask-image] duration-200',
                  'group-hover/item:mask-[linear-gradient(to_left,transparent_0px,transparent_24px,black_48px)]',
                )}
              >
                <div className="flex min-w-0 flex-row items-center gap-2 text-xs">
                  <span className="truncate">{item.label}</span>
                </div>
                {hasDescription && (
                  <span className="truncate text-subtle-foreground text-xs leading-normal">
                    {item.description}
                  </span>
                )}
              </div>
              <span className="-translate-y-1/2 absolute top-1/2 right-1 opacity-0 transition-opacity duration-150 group-hover/item:opacity-100">
                <IconPlusFill18 className="size-3 text-muted-foreground group-hover/item:text-foreground" />
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Mount {name}</TooltipContent>
        </Tooltip>
      );
    }

    // "Mount a new workspace" item
    return (
      <div className="flex w-full cursor-pointer flex-col">
        <div className="flex min-w-0 flex-row items-center gap-2 text-xs">
          <span className="truncate">{item.label}</span>
        </div>
        {hasDescription && (
          <span className="truncate text-subtle-foreground text-xs leading-normal">
            {item.description}
          </span>
        )}
      </div>
    );
  }, []);

  const handleUnmount = useCallback(
    (prefix: string) => {
      if (openAgent) {
        void unmountWorkspace(openAgent, prefix);
        onWorkspaceChange?.();
      }
    },
    [openAgent, unmountWorkspace, onWorkspaceChange],
  );

  if (!openAgent) return null;

  return (
    <>
      {/* Mounted workspace badges */}
      {allMounts.map((mount) => {
        const name = mount.path.split('/').pop() || mount.path;
        return (
          <div
            key={mount.prefix}
            className={cn(
              'group/badge inline-flex items-center gap-1',
              'rounded-md border border-derived-subtle px-1.5 py-0.5',
              'text-xs transition-colors duration-100',
              'hover:bg-hover-derived',
            )}
          >
            <IconFolderContent2FillDuo18 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="max-w-32 truncate text-foreground">{name}</span>
            <Tooltip>
              <TooltipTrigger>
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={() => handleUnmount(mount.prefix)}
                  className={cn(
                    'flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded',
                    'text-subtle-foreground transition-colors duration-100',
                    'hover:text-foreground',
                  )}
                >
                  <IconXmarkFill18 className="size-2.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Unmount {name}</TooltipContent>
            </Tooltip>
          </div>
        );
      })}

      {/* Mount button — opens the Select popover with recents */}
      <Select
        items={menuItems}
        value={null}
        onValueChange={handleMenuSelect}
        side="top"
        sideOffset={8}
        popupClassName="max-w-64"
        scrollContainerClassName="max-h-96"
        size="xs"
        showItemIndicator={false}
        itemClassName="relative [&>*]:w-full"
        renderItem={renderItem}
        customTrigger={(triggerProps) =>
          hasMounts ? (
            <Tooltip>
              <TooltipTrigger>
                <button
                  {...triggerProps}
                  className={cn(
                    'mr-1 inline-flex cursor-pointer items-center gap-0.5',
                    'rounded-md border border-derived-subtle px-1.5 py-0.5',
                    'text-muted-foreground transition-colors duration-100',
                    'hover:bg-hover-derived hover:text-foreground',
                  )}
                >
                  <IconFolderContent2FillDuo18 className="size-3.5" />
                  <IconPlusFill18 className="size-2.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Give the agent access to your files.
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger>
                <button
                  {...triggerProps}
                  className={cn(
                    'mr-1 inline-flex cursor-pointer items-center gap-1',
                    'rounded-md border border-derived-subtle px-2 py-0.5',
                    'text-muted-foreground text-xs transition-colors duration-100',
                    'hover:bg-hover-derived hover:text-foreground',
                  )}
                >
                  <IconFolderContent2FillDuo18 className="size-3.5" />
                  <span>Mount a workspace</span>
                  <IconPlusFill18 className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Give the agent access to your files.
              </TooltipContent>
            </Tooltip>
          )
        }
      />
    </>
  );
}
