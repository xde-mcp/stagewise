import type { ToolUIPart } from 'ai';
import type { StagewiseUITools } from '@shared/karton-contracts/ui/agent/tools/types';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@stagewise/stage-ui/components/tooltip';
import { ToolPartUINotCollapsible } from './shared/tool-part-ui-not-collapsible';
import { IconMagicWandFillDuo18 } from 'nucleo-ui-fill-duo-18';

export const UpdateProjectMdToolPart = ({
  part,
  disableShimmer = false,
  minimal = false,
}: {
  part: Extract<
    ToolUIPart<StagewiseUITools>,
    { type: 'tool-updateProjectMdTool' }
  >;
  disableShimmer?: boolean;
  minimal?: boolean;
}) => {
  const streamingText = `Triggering update of PROJECT.md...`;

  const finishedText =
    part.state === 'output-available' ? (
      <Tooltip>
        <TooltipTrigger>
          <span className="flex min-w-0 gap-1">
            <span className="shrink-0 truncate font-medium">
              Triggered update{' '}
            </span>
            <span className="truncate font-normal opacity-75">
              of PROJECT.md
            </span>
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
