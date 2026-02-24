import { memo } from 'react';
import { cn } from '@/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { Button } from '@stagewise/stage-ui/components/button';
import { IconTrash2Outline24 } from 'nucleo-core-outline-24';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en';

TimeAgo.addLocale(en);
const timeAgo = new TimeAgo('en-US');

export interface AgentCardProps {
  id: string;
  title: string;
  isActive: boolean;
  isWorking: boolean;
  hasError: boolean;
  hasUnseen: boolean;
  activityText: string;
  activityIsUserInput: boolean;
  lastMessageAt: number;
  onClick: (id: string) => void;
  onDelete: (id: string) => void;
}

export const AgentCard = memo(function AgentCard({
  id,
  title,
  isActive,
  isWorking,
  hasError,
  hasUnseen,
  activityText,
  activityIsUserInput,
  lastMessageAt,
  onClick,
  onDelete,
}: AgentCardProps) {
  const subtitle = hasError ? 'Error' : activityText;

  return (
    <button
      type="button"
      data-agent-id={id}
      onClick={() => onClick(id)}
      className={cn(
        'group/card relative flex min-w-0 shrink-0 cursor-pointer flex-col gap-0.5 rounded-md bg-surface-1 px-2 py-1.5 text-left transition-colors hover:bg-surface-2',
        isActive && 'bg-surface-2 ring-2 ring-derived-subtle ring-inset',
        hasUnseen && 'animate-ring-pulse-primary',
      )}
    >
      <Tooltip>
        <TooltipTrigger delay={500}>
          <span className="block w-full overflow-x-clip text-ellipsis whitespace-nowrap font-medium text-foreground text-xs leading-normal">
            {title}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <span>{title}</span>
        </TooltipContent>
      </Tooltip>
      <div className="flex w-full items-baseline gap-2">
        <span
          className={cn(
            'min-w-0 flex-1 overflow-x-clip text-ellipsis whitespace-nowrap text-muted-foreground text-xs leading-normal',
            isWorking && 'shimmer-text-primary font-medium',
            hasError && 'text-destructive-foreground',
            activityIsUserInput && 'italic',
          )}
        >
          {subtitle || '\u00A0'}
        </span>
        {lastMessageAt > 0 && (
          <span className="shrink-0 whitespace-nowrap text-subtle-foreground text-xs leading-normal">
            {timeAgo.format(lastMessageAt)}
          </span>
        )}
      </div>
      <div className="absolute inset-y-[2px] right-[2px] flex items-center rounded-r-[calc(var(--radius-md)-2px)] bg-linear-to-r from-transparent to-[20px] to-surface-2 pr-2 pl-6 opacity-0 transition-opacity group-hover/card:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          className="delete-btn text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
        >
          <IconTrash2Outline24 className="size-4 cursor-pointer" />
        </Button>
      </div>
    </button>
  );
});
