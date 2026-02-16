import { MessageEditStateProvider } from '@/hooks/use-message-edit-state';
import type { ReactNode } from 'react';
import { KartonProvider } from '@/hooks/use-karton';
import { TooltipProvider } from '@stagewise/stage-ui/components/tooltip';
import { PostHogProvider } from '@/hooks/use-posthog';
import { TabStateUIProvider } from '../hooks/use-tab-ui-state';
import { ErrorBoundary } from './error-boundary';

export function ContextProviders({ children }: { children?: ReactNode }) {
  return (
    <TooltipProvider>
      <KartonProvider>
        <PostHogProvider>
          <ErrorBoundary>
            <MessageEditStateProvider>
              <TabStateUIProvider>{children}</TabStateUIProvider>
            </MessageEditStateProvider>
          </ErrorBoundary>
        </PostHogProvider>
      </KartonProvider>
    </TooltipProvider>
  );
}
