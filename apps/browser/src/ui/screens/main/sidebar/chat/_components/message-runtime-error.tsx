import { useState } from 'react';
import { cn } from '@/utils';
import { IconTriangleWarning } from 'nucleo-micro-bold';
import { Button } from '@stagewise/stage-ui/components/button';
import { RefreshCcwIcon, CopyIcon, CopyCheckIcon } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@stagewise/stage-ui/components/collapsible';
import { ChevronDownIcon } from 'lucide-react';

type RuntimeError = {
  code?: number;
  message: string;
  stack?: string;
};

export function MessageRuntimeError({
  agentInstanceId,
  error,
  onRetry,
  canRetry,
}: {
  agentInstanceId: string;
  error: RuntimeError;
  onRetry: () => void;
  canRetry: boolean;
}) {
  const [helpExpanded, setHelpExpanded] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const copyError = () => {
    const errorText = `Error${error.code ? ` (Code: ${error.code})` : ''}: ${error.message}${error.stack ? `\n\nStack trace:\n${error.stack}` : ''}`;
    navigator.clipboard.writeText(errorText);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="mt-6 flex w-full flex-col gap-1.5 rounded-lg border border-derived-strong p-2 text-sm">
      {/* Error Header */}
      <div className="flex flex-row items-center gap-1.5">
        <IconTriangleWarning className="size-3.5 shrink-0 text-error-foreground" />
        <span className="font-medium text-error-foreground">Error</span>
        <Button
          variant="ghost"
          size="icon-2xs"
          className="ml-auto"
          onClick={copyError}
        >
          {hasCopied ? (
            <CopyCheckIcon className="size-3" />
          ) : (
            <CopyIcon className="size-3" />
          )}
        </Button>
      </div>

      {/* Error Message */}
      <div className="text-foreground">
        {error.message}{' '}
        {error.code && (
          <span className="text-muted-foreground text-xs">
            (Code: {error.code})
          </span>
        )}
      </div>

      {/* Help Section */}
      <Collapsible open={helpExpanded} onOpenChange={setHelpExpanded}>
        <CollapsibleTrigger
          size="condensed"
          className="-mx-1 flex w-[calc(100%+0.5rem)] items-center justify-between gap-2 py-0.5"
        >
          <span className="text-xs">What to do if the issue persists?</span>
          <ChevronDownIcon
            className={cn(
              'size-3 transition-transform',
              helpExpanded && 'rotate-180',
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-0.5 text-muted-foreground text-xs">
            If this error continues to occur, you can{' '}
            <a
              href={`https://github.com/stagewise-io/stagewise/issues/new?template=5.agent_issue.yml&conversation-id=${agentInstanceId}&error-data=${encodeURIComponent(JSON.stringify(error))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-foreground underline hover:text-primary-foreground/80"
            >
              report it on GitHub
            </a>
            . Please include the error message and stack trace (if available) to
            help us diagnose the issue.
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Retry Button */}
      {canRetry && (
        <div className="-mt-1 flex flex-row justify-end">
          <Button variant="ghost" size="xs" onClick={onRetry}>
            <RefreshCcwIcon className="size-3" />
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
