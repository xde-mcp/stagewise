import { Button } from '@stagewise/stage-ui/components/button';
import { IconSidebarLeftShowOutline18 } from 'nucleo-ui-outline-18';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@stagewise/stage-ui/components/tooltip';
import { HotkeyActions } from '@shared/hotkeys';
import { HotkeyComboText } from '@/components/hotkey-combo-text';
import { useKartonState } from '@/hooks/use-karton';
import { cn } from '@/utils';
import { useOpenAgent } from '@/hooks/use-open-chat';

type AgentPreviewBadgeProps = {
  onClick: () => void;
};

export function AgentPreviewBadge({ onClick }: AgentPreviewBadgeProps) {
  const [openAgent] = useOpenAgent();
  const isWorking = useKartonState((s) =>
    openAgent ? s.agents.instances[openAgent]?.state.isWorking : false,
  );

  return (
    <div className="flex h-full shrink-0 flex-row items-center rounded-lg rounded-br-[6px] p-1 pr-2">
      <Tooltip>
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative shrink-0"
            onClick={onClick}
          >
            <IconSidebarLeftShowOutline18
              className={cn(
                'size-4',
                isWorking ? 'animate-icon-pulse text-primary' : '',
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-row items-center gap-1">
            <span className="text-xs">Toggle chat panel</span>
            <div className="pointer-events-none flex shrink-0 flex-row items-center gap-0 opacity-40">
              <span className="font-mono text-muted-foreground text-xs">
                <HotkeyComboText
                  action={HotkeyActions.TOGGLE_CONTEXT_SELECTOR}
                />
              </span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
