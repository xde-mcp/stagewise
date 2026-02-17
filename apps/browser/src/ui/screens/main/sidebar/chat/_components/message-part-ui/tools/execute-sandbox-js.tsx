import { ChevronDownIcon, Loader2Icon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { IconWindowPointerOutline18 } from 'nucleo-ui-outline-18';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@stagewise/stage-ui/components/collapsible';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import { ToolPartUI } from './shared/tool-part-ui';
import { CodeBlock } from '@/components/ui/code-block';
import { StreamingCodeBlock } from '@/components/ui/streaming-code-block';
import { cn } from '@/utils';
import { useToolAutoExpand } from './shared/use-tool-auto-expand';
import { useKartonState } from '@/hooks/use-karton';
import type { AgentToolUIPart } from '@shared/karton-contracts/ui/agent';
import { getSandboxLabel } from './utils/cdp-label-utils';

export const ExecuteSandboxJsToolPart = ({
  part,
  capMaxHeight = false,
  showBorder = false,
  disableShimmer = false,
  isLastPart = false,
}: {
  part: Extract<AgentToolUIPart, { type: 'tool-executeSandboxJsTool' }>;
  capMaxHeight?: boolean;
  showBorder?: boolean;
  disableShimmer?: boolean;
  isLastPart?: boolean;
}) => {
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const [resultExpanded, setResultExpanded] = useState(true);
  const activeTabs = useKartonState((s) => s.browser.tabs);

  const streaming = useMemo(() => {
    return part.state === 'input-streaming' || part.state === 'input-available';
  }, [part.state]);

  const state = useMemo(() => {
    if (streaming) return 'streaming';
    if (part.state === 'output-error') return 'error';
    return 'success';
  }, [part.state, streaming]);

  // Generate contextual labels based on CDP calls in the script
  const inProgressLabel = useMemo(() => {
    return getSandboxLabel(part.input?.script, activeTabs, true);
  }, [part.input?.script, activeTabs]);

  const completedLabel = useMemo(() => {
    return getSandboxLabel(part.input?.script, activeTabs, false);
  }, [part.input?.script, activeTabs]);

  // Use the unified auto-expand hook
  const { expanded, handleUserSetExpanded } = useToolAutoExpand({
    isStreaming: streaming,
    isLastPart,
  });

  // Format the result as pretty-printed JSON if possible
  const formattedResult = useMemo(() => {
    const result = part.output?.result?.result;
    if (!result) return null;
    try {
      const parsed = JSON.parse(result);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If it's not valid JSON, return as-is
      return result;
    }
  }, [part.output?.result?.result]);

  if (state === 'error') {
    return (
      <ToolPartUI
        showBorder={showBorder}
        expanded={expanded}
        setExpanded={handleUserSetExpanded}
        trigger={
          <>
            <XIcon className="size-3 shrink-0" />
            <span className="truncate text-start font-medium text-xs">
              Error while running a script
            </span>
          </>
        }
        content={
          <div className="flex flex-col">
            {part.input?.script && (
              <Collapsible
                open={scriptExpanded}
                onOpenChange={setScriptExpanded}
              >
                <CollapsibleTrigger size="condensed" className="">
                  <button
                    type="button"
                    onClick={() => setScriptExpanded(!scriptExpanded)}
                    className="mb-1 flex cursor-pointer items-center gap-1 text-[10px] uppercase tracking-wider"
                  >
                    <ChevronDownIcon
                      className={cn(
                        'size-3 transition-transform duration-150',
                        !scriptExpanded && '-rotate-90',
                      )}
                    />
                    Script
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="duration-0!">
                  {capMaxHeight ? (
                    <OverlayScrollbar
                      className="max-h-28"
                      options={{ overflow: { x: 'hidden', y: 'scroll' } }}
                    >
                      <CodeBlock
                        code={part.input.script}
                        language="javascript"
                        hideActionButtons
                      />
                    </OverlayScrollbar>
                  ) : (
                    <div className="overflow-y-hidden">
                      <CodeBlock
                        code={part.input.script}
                        language="javascript"
                        hideActionButtons
                      />
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}
            {part.errorText && (
              <Collapsible
                open={resultExpanded}
                onOpenChange={setResultExpanded}
              >
                <CollapsibleTrigger size="condensed" className="">
                  <button
                    type="button"
                    onClick={() => setResultExpanded(!resultExpanded)}
                    className="mb-1 flex cursor-pointer items-center gap-1 text-[10px] uppercase tracking-wider"
                  >
                    <ChevronDownIcon
                      className={cn(
                        'size-3 transition-transform duration-150',
                        !resultExpanded && '-rotate-90',
                      )}
                    />
                    Error
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="duration-0!">
                  <OverlayScrollbar
                    className={cn('max-h-24')}
                    options={{ overflow: { x: 'hidden', y: 'scroll' } }}
                  >
                    <CodeBlock
                      code={part.errorText}
                      language="javascript"
                      hideActionButtons
                    />
                  </OverlayScrollbar>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        }
        contentClassName={capMaxHeight ? 'max-h-80!' : undefined}
        contentFooterClassName="px-0"
      />
    );
  }

  return (
    <ToolPartUI
      showBorder={showBorder}
      expanded={expanded}
      setExpanded={handleUserSetExpanded}
      trigger={
        <>
          {!streaming && (
            <IconWindowPointerOutline18 className="size-3 shrink-0" />
          )}
          <div
            className={cn(
              'flex flex-row items-center justify-start gap-1',
              showBorder && 'flex-1',
            )}
          >
            {streaming ? (
              <LoadingHeader
                disableShimmer={disableShimmer}
                label={inProgressLabel}
              />
            ) : (
              <SuccessHeader
                capMaxHeight={capMaxHeight}
                label={completedLabel}
              />
            )}
          </div>
        </>
      }
      content={
        <>
          {part.input?.script && streaming && (
            <StreamingCodeBlock
              code={part.input.script}
              language="javascript"
            />
          )}
          {state === 'success' && part.input?.script && (
            <div className="flex flex-col">
              <Collapsible
                open={scriptExpanded}
                onOpenChange={setScriptExpanded}
              >
                <CollapsibleTrigger size="condensed" className="">
                  <button
                    type="button"
                    onClick={() => setScriptExpanded(!scriptExpanded)}
                    className="mb-1 flex cursor-pointer items-center gap-1 text-[10px] uppercase tracking-wider"
                  >
                    <ChevronDownIcon
                      className={cn(
                        'size-3 transition-transform duration-150',
                        !scriptExpanded && '-rotate-90',
                      )}
                    />
                    Script
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="duration-0!">
                  {capMaxHeight ? (
                    <OverlayScrollbar
                      className="max-h-28"
                      options={{ overflow: { x: 'hidden', y: 'scroll' } }}
                    >
                      <CodeBlock
                        code={part.input.script}
                        language="javascript"
                        hideActionButtons
                      />
                    </OverlayScrollbar>
                  ) : (
                    <div className="overflow-y-hidden">
                      <CodeBlock
                        code={part.input.script}
                        language="javascript"
                        hideActionButtons
                      />
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
              {formattedResult && (
                <Collapsible
                  open={resultExpanded}
                  onOpenChange={setResultExpanded}
                >
                  <CollapsibleTrigger size="condensed" className="">
                    <button
                      type="button"
                      onClick={() => setResultExpanded(!resultExpanded)}
                      className="mb-1 flex cursor-pointer items-center gap-1 text-[10px] uppercase tracking-wider"
                    >
                      <ChevronDownIcon
                        className={cn(
                          'size-3 transition-transform duration-150',
                          !resultExpanded && '-rotate-90',
                        )}
                      />
                      Result
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="duration-0!">
                    <OverlayScrollbar
                      className={cn('max-h-24')}
                      options={{ overflow: { x: 'hidden', y: 'scroll' } }}
                    >
                      <CodeBlock
                        code={formattedResult}
                        language="json"
                        hideActionButtons
                      />
                    </OverlayScrollbar>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}
        </>
      }
      contentClassName={
        capMaxHeight ? (streaming ? 'max-h-32!' : 'max-h-80!') : undefined
      }
      contentFooterClassName="px-0"
    />
  );
};

const SuccessHeader = ({
  capMaxHeight,
  label,
}: {
  capMaxHeight?: boolean;
  label: string;
}) => {
  return (
    <div className="pointer-events-none flex flex-row items-center justify-start gap-1">
      <div className="pointer-events-auto flex flex-row items-center justify-start gap-1">
        <span
          className={cn('shrink-0 text-xs', !capMaxHeight && 'font-normal')}
        >
          {capMaxHeight ? label : <span className="font-medium">{label}</span>}
        </span>
      </div>
    </div>
  );
};

const LoadingHeader = ({
  disableShimmer,
  label,
}: {
  disableShimmer?: boolean;
  label: string;
}) => {
  return (
    <div className="flex flex-row items-center justify-start gap-1">
      <Loader2Icon
        className={cn(
          'size-3 shrink-0 animate-spin',
          disableShimmer ? '' : 'text-primary-foreground',
        )}
      />
      <span
        dir="ltr"
        className={cn('text-xs', disableShimmer ? '' : 'shimmer-text-primary')}
      >
        {label}
      </span>
    </div>
  );
};
