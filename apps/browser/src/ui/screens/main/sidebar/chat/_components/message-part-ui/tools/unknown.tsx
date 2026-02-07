import type { ToolUIPart, DynamicToolUIPart } from 'ai';
import type { StagewiseUITools } from '@shared/karton-contracts/ui/agent/tools/types';
import { ToolPartUINotCollapsible } from './shared/tool-part-ui-not-collapsible';
import { CircleQuestionMarkIcon } from 'lucide-react';

export const UnknownToolPart = ({
  part,
  shimmer = false,
}: {
  part: ToolUIPart<StagewiseUITools> | DynamicToolUIPart;
  shimmer?: boolean;
}) => {
  const streamingText = `Calling tool ${part.type}...`;
  const finishedText = `Finished calling tool ${part.type}`;
  return (
    <ToolPartUINotCollapsible
      part={part}
      icon={<CircleQuestionMarkIcon className="size-3 shrink-0" />}
      disableShimmer={!shimmer}
      minimal={true}
      streamingText={streamingText}
      finishedText={finishedText}
    />
  );
};
