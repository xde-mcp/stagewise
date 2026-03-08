import { useState, useEffect } from 'react';
import { useKartonState } from '@/hooks/use-karton';
import { useOpenAgent } from '@/hooks/use-open-chat';
import { Button } from '@stagewise/stage-ui/components/button';
import { cn } from '@stagewise/stage-ui/lib/utils';
import { XIcon, TriangleAlertIcon } from 'lucide-react';

let usageWarningDismissedThisSession = false;

export function UsageWarningBadge() {
  const [openAgent] = useOpenAgent();
  const [dismissed, setDismissed] = useState(
    () => usageWarningDismissedThisSession,
  );

  const usageWarning = useKartonState((s) => {
    if (!openAgent) return undefined;
    return s.agents.instances[openAgent]?.state.usageWarning;
  });

  const [statusCardVisible, setStatusCardVisible] = useState(false);
  useEffect(() => {
    const check = () => {
      const val = getComputedStyle(document.documentElement)
        .getPropertyValue('--status-card-height')
        .trim();
      setStatusCardVisible(val !== '' && val !== '0px');
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    });
    return () => observer.disconnect();
  }, []);

  if (dismissed || !usageWarning) return null;

  const pct = Math.round(usageWarning.usedPercent);
  const window = usageWarning.windowType;

  return (
    <div
      className={cn(
        'relative flex shrink-0 flex-row items-start gap-2 rounded-md bg-background p-2.5 shadow-elevation-1 ring-1 ring-derived-strong dark:bg-surface-1',
        statusCardVisible ? 'mx-3' : 'mx-1',
      )}
      style={{
        marginBottom: 'calc(var(--status-card-height, 0px) + 0.5rem)',
      }}
    >
      <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" />
      <span className="text-foreground text-xs">
        You&apos;ve used {pct}% of your {window} limit. Consider switching to a
        cheaper model.
      </span>
      <Button
        variant="ghost"
        size="icon-2xs"
        className="ml-auto shrink-0"
        aria-label="Dismiss usage warning"
        onClick={() => {
          usageWarningDismissedThisSession = true;
          setDismissed(true);
        }}
      >
        <XIcon className="size-3" />
      </Button>
    </div>
  );
}
