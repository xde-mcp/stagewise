import type { DynamicToolUIPart } from 'ai';
import type { AgentToolUIPart } from '@shared/karton-contracts/ui/agent';
import { ToolPartUINotCollapsible } from './shared/tool-part-ui-not-collapsible';
import { CircleQuestionMarkIcon } from 'lucide-react';

export const UnknownToolPart = ({
  part,
  shimmer = false,
}: {
  part: AgentToolUIPart | DynamicToolUIPart;
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
