import { cn } from '@/utils';
import { RefreshCwIcon, Loader2Icon } from 'lucide-react';
import { ToolbarButton } from '../components/button';
import { ToolbarSection } from '../components/section';
import { useAgents } from '@/hooks/agent/use-agent-provider';

export function DisconnectedContent() {
  const { refreshAgentList, isRefreshing, isAppHostedAgent } = useAgents();

  // For app-hosted agents, show a loading spinner instead of refresh button
  if (isAppHostedAgent) {
    return (
      <ToolbarSection>
        <ToolbarButton className="cursor-default">
          <Loader2Icon className="size-4 animate-spin" />
        </ToolbarButton>
      </ToolbarSection>
    );
  }

  return (
    <ToolbarSection>
      <ToolbarButton
        onClick={!isRefreshing ? () => refreshAgentList() : undefined}
      >
        <RefreshCwIcon
          className={cn('size-4', isRefreshing && 'animate-spin')}
        />
      </ToolbarButton>
    </ToolbarSection>
  );
}
