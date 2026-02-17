import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@stagewise/stage-ui/components/tooltip';
import { ToolPartUINotCollapsible } from './shared/tool-part-ui-not-collapsible';
import { IconMagicWandFillDuo18 } from 'nucleo-ui-fill-duo-18';
import type { AgentToolUIPart } from '@shared/karton-contracts/ui/agent';

export const UpdateWorkspaceMdToolPart = ({
  part,
  disableShimmer = false,
  minimal = false,
}: {
  part: Extract<AgentToolUIPart, { type: 'tool-updateWorkspaceMdTool' }>;
  disableShimmer?: boolean;
  minimal?: boolean;
}) => {
  const streamingText = `Triggering update of ...`;

  const finishedText =
    part.state === 'output-available' ? (
      <Tooltip>
        <TooltipTrigger>
          <span className="flex min-w-0 gap-1">
            <span className="shrink-0 truncate font-medium">
              Triggered update{' '}
            </span>
            <span className="truncate font-normal opacity-75">of</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{part.input?.updateReason}</TooltipContent>
      </Tooltip>
    ) : undefined;

  return (
    <ToolPartUINotCollapsible
      icon={<IconMagicWandFillDuo18 className="size-3 shrink-0" />}
      part={part}
      minimal={minimal}
      disableShimmer={disableShimmer}
      streamingText={streamingText}
      finishedText={finishedText}
    />
  );
};
