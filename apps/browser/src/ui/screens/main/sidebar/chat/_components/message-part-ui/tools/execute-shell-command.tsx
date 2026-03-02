import { Loader2Icon, TerminalIcon, XIcon } from 'lucide-react';
import { useCallback, useMemo, useRef } from 'react';
import { ToolPartUI } from './shared/tool-part-ui';
import { useToolAutoExpand } from './shared/use-tool-auto-expand';
import { CodeBlock } from '@/components/ui/code-block';
import { StreamingCodeBlock } from '@/components/ui/streaming-code-block';
import { useIsTruncated } from '@ui/hooks/use-is-truncated';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import { useOpenAgent } from '@/hooks/use-open-chat';
import { cn } from '@/utils';
import { Button } from '@stagewise/stage-ui/components/button';
import type { AgentToolUIPart } from '@shared/karton-contracts/ui/agent';
import type { ExecuteShellCommandToolOutput } from '@shared/karton-contracts/ui/agent/tools/types';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';

export const ExecuteShellCommandToolPart = ({
  part,
  isLastPart = false,
}: {
  part: Extract<AgentToolUIPart, { type: 'tool-executeShellCommandTool' }>;
  isLastPart?: boolean;
}) => {
  const [openAgentId] = useOpenAgent();
  const sendApproval = useKartonProcedure(
    (p) => p.agents.sendToolApprovalResponse,
  );
  const cancelShellCommand = useKartonProcedure(
    (p) => p.toolbox.cancelShellCommand,
  );

  const finished = useMemo(
    () =>
      part.state === 'output-available' ||
      part.state === 'output-error' ||
      part.state === 'output-denied',
    [part.state],
  );

  const pendingOutputs = useKartonState((s) =>
    openAgentId
      ? s.toolbox[openAgentId]?.pendingShellOutputs?.[part.toolCallId]
      : undefined,
  );

  const retainedOutputsRef = useRef<string[] | null>(null);
  if (pendingOutputs && pendingOutputs.length > 0)
    retainedOutputsRef.current = pendingOutputs;

  const prevFinishedRef = useRef(finished);
  if (finished && !prevFinishedRef.current) retainedOutputsRef.current = null;
  prevFinishedRef.current = finished;

  const output = part.output as ExecuteShellCommandToolOutput | undefined;

  const state = useMemo(() => {
    if (part.state === 'approval-requested') return 'approval' as const;
    if (part.state === 'input-streaming') return 'approval' as const;
    if (part.state === 'output-denied') return 'denied' as const;
    if (
      part.state === 'approval-responded' &&
      pendingOutputs &&
      pendingOutputs.length > 0
    )
      return 'streaming' as const;
    if (part.state === 'input-available') return 'streaming' as const;
    if (part.state === 'approval-responded')
      return 'approval-responded' as const;
    if (part.state === 'output-error') return 'error' as const;
    return 'success' as const;
  }, [part.state, pendingOutputs]);

  const command = part.input?.command ?? '';

  const effectiveOutputText = useMemo(() => {
    if (output?.output) return output.output;
    if (retainedOutputsRef.current?.length)
      return retainedOutputsRef.current.join('');
    return null;
  }, [output?.output, pendingOutputs]);

  const { expanded, handleUserSetExpanded } = useToolAutoExpand({
    isStreaming: state === 'streaming' || state === 'approval',
    isLastPart,
  });

  const handleApprove = useCallback(() => {
    if (
      !openAgentId ||
      part.state !== 'approval-requested' ||
      !part.approval?.id
    )
      return;
    sendApproval(openAgentId, part.approval.id, true);
  }, [openAgentId, part.state, part.approval, sendApproval]);

  const handleCancel = useCallback(() => {
    if (!openAgentId || !part.toolCallId) return;
    cancelShellCommand(openAgentId, part.toolCallId);
  }, [openAgentId, part.toolCallId, cancelShellCommand]);

  const handleDeny = useCallback(() => {
    if (
      !openAgentId ||
      part.state !== 'approval-requested' ||
      !part.approval?.id
    )
      return;
    sendApproval(openAgentId, part.approval.id, false, 'User denied');
  }, [openAgentId, part.state, part.approval, sendApproval]);

  const trigger = useMemo(() => {
    if (state === 'approval' || state === 'approval-responded') {
      return (
        <div className="flex flex-row items-center justify-start gap-1">
          <TerminalIcon className="size-3 shrink-0 text-warning" />
          <span className="flex min-w-0 gap-1 text-xs">
            <span className="shrink-0 font-medium">Run command:</span>
            <TruncatedCommandText
              text={command || 'Shell command'}
              className="font-normal opacity-75"
            />
          </span>
        </div>
      );
    }

    if (state === 'denied') {
      return (
        <div className="flex flex-row items-center justify-start gap-1">
          <TerminalIcon className="size-3 shrink-0" />
          <span className="flex min-w-0 gap-1 text-xs">
            <span className="shrink-0 font-medium">Skipped command:</span>
            <TruncatedCommandText
              text={command}
              className="font-normal opacity-75"
            />
          </span>
        </div>
      );
    }

    if (state === 'error') {
      return (
        <div className="flex flex-row items-center justify-start gap-1">
          <XIcon className="size-3 shrink-0" />
          <TruncatedCommandText
            text={part.errorText ?? `Error running: ${command}`}
            className="text-xs"
          />
        </div>
      );
    }

    if (state === 'streaming') {
      return (
        <div className="flex w-full flex-row items-center justify-start gap-1">
          <Loader2Icon className="size-3 shrink-0 animate-spin text-primary-foreground" />
          <span className="flex min-w-0 gap-1 text-xs">
            <TruncatedCommandText
              text={`Running command: ${command}` || '...'}
              className="shimmer-text-primary"
            />
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleCancel();
            }}
            className="-mr-2 ml-auto"
          >
            Cancel
          </Button>
        </div>
      );
    }

    const exitCode = output?.exit_code;
    const aborted = output?.aborted;
    const timedOut = output?.timed_out;

    if (!aborted && !timedOut) {
      return (
        <div className="pointer-events-none flex flex-row items-center justify-start gap-1">
          <TerminalIcon className="size-3 shrink-0" />
          <span className="flex min-w-0 gap-1 text-xs">
            {exitCode === 0 ? (
              <span className="shrink-0 font-medium">Ran command:</span>
            ) : (
              <span className="shrink-0 font-medium">
                Ran command ({exitCode}):
              </span>
            )}
            <TruncatedCommandText
              text={command}
              className="pointer-events-auto font-normal opacity-75"
            />
          </span>
        </div>
      );
    }

    let statusLabel: string;
    if (aborted) statusLabel = 'cancelled';
    else if (timedOut) statusLabel = 'timed out';
    else if (exitCode === 0) statusLabel = 'exit 0';
    else if (exitCode !== null && exitCode !== undefined)
      statusLabel = `exit ${exitCode}`;
    else statusLabel = 'killed';
    // TODO: Make 'approve' and 'run', etc. have the same content height!!! (SO there are no jumps when approving and streaming starts)

    return (
      <div className="pointer-events-none flex flex-row items-center justify-start gap-1">
        <TerminalIcon className="size-3 shrink-0" />
        <span className="flex min-w-0 gap-1 text-xs">
          <span className="shrink-0 font-medium">Command {statusLabel}:</span>
          <TruncatedCommandText
            text={command}
            className="pointer-events-auto font-normal opacity-75"
          />
        </span>
      </div>
    );
  }, [
    state,
    part.errorText,
    command,
    output?.exit_code,
    output?.aborted,
    output?.timed_out,
  ]);

  const content = useMemo(() => {
    if (state === 'denied') return undefined;
    if (state === 'error') return undefined;

    if (state === 'approval' || state === 'approval-responded') {
      return (
        <CodeBlock code={`${command}\n`} language="bash" hideActionButtons />
      );
    }

    if (state === 'streaming') {
      const text = effectiveOutputText || command;
      return <StreamingCodeBlock code={text} language="shellsession" />;
    }

    const displayText = effectiveOutputText || output?.message || command;
    if (displayText) {
      return (
        <CodeBlock
          code={displayText}
          language="shellsession"
          hideActionButtons
        />
      );
    }

    return undefined;
  }, [state, part.errorText, effectiveOutputText, command, output?.message]);

  const contentFooter = useMemo(() => {
    if (state === 'approval' || state === 'approval-responded')
      return (
        <div className="flex w-full flex-row items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleDeny}
            disabled={state === 'approval-responded'}
          >
            Skip
          </Button>
          <Button
            variant="primary"
            size="xs"
            onClick={handleApprove}
            disabled={state === 'approval-responded'}
          >
            {state === 'approval-responded' && (
              <Loader2Icon className="size-3 shrink-0 animate-spin" />
            )}
            Allow
          </Button>
        </div>
      );
    return undefined;
  }, [state, handleApprove, handleDeny]);

  return (
    <ToolPartUI
      hideChevron={state === 'streaming'}
      showBorder={true}
      expanded={expanded}
      setExpanded={handleUserSetExpanded}
      isShimmering={state === 'streaming'}
      autoScroll={state === 'streaming'}
      trigger={trigger}
      content={content}
      contentFooter={contentFooter}
      contentFooterClassName="px-1 h-8 border-none"
      contentClassName={cn(
        state === 'approval' || state === 'approval-responded'
          ? 'h-16 max-h-16 pb-0'
          : 'h-22 max-h-22 pb-0',
      )}
    />
  );
};

function TruncatedCommandText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const { isTruncated, tooltipOpen, setTooltipOpen } = useIsTruncated(ref);

  return (
    <Tooltip open={isTruncated && tooltipOpen} onOpenChange={setTooltipOpen}>
      <TooltipTrigger delay={50}>
        <span ref={ref} className={cn('min-w-0 truncate', className)}>
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start">
        <div className="max-w-xs break-all">{text}</div>
      </TooltipContent>
    </Tooltip>
  );
}
