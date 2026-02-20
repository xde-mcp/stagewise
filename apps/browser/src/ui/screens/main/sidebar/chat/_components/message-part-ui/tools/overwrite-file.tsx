import type { AgentToolUIPart } from '@shared/karton-contracts/ui/agent';
import type { WithDiff } from '@shared/karton-contracts/ui/agent/tools/types';
import { FileIcon } from '@/components/file-icon';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@stagewise/stage-ui/components/tooltip';
import {
  Loader2Icon,
  XIcon,
  ListChevronsDownUpIcon,
  ListChevronsUpDownIcon,
} from 'lucide-react';
import { Skeleton } from '@stagewise/stage-ui/components/skeleton';
import { useFileIDEHref } from '@/hooks/use-file-ide-href';
import { IdePickerPopover } from '@/components/ide-picker-popover';
import { DiffPreview } from './shared/diff-preview';
import { cn, IDE_SELECTION_ITEMS } from '@/utils';
import { useMemo, useState } from 'react';
import { ToolPartUI } from './shared/tool-part-ui';
import { diffLines } from 'diff';
import { Button, buttonVariants } from '@stagewise/stage-ui/components/button';

import { useKartonState } from '@/hooks/use-karton';
import { IdeLogo } from '@/components/ide-logo';
import {
  StreamingCodeBlock,
  getLanguageFromPath,
} from '@ui/components/ui/streaming-code-block';

export const OverwriteFileToolPart = ({
  part,
}: {
  part: Extract<AgentToolUIPart, { type: 'tool-overwriteFileTool' }>;
}) => {
  const [codeDiffCollapsed, setCodeDiffCollapsed] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const { getFileIDEHref, needsIdePicker, pickIdeAndOpen } = useFileIDEHref();
  const outputWithDiff = part.output as
    | WithDiff<typeof part.output>
    | undefined;

  const diff = useMemo(
    () =>
      outputWithDiff?._diff
        ? diffLines(
            outputWithDiff._diff.before ?? '',
            outputWithDiff._diff.after ?? '',
          )
        : null,
    [outputWithDiff?._diff],
  );

  const newLineCount = useMemo(
    () =>
      diff
        ?.filter((line) => line.added)
        .reduce((acc, line) => acc + (line.count ?? 0), 0) ?? 0,
    [diff],
  );
  const deletedLineCount = useMemo(
    () =>
      diff
        ?.filter((line) => line.removed)
        .reduce((acc, line) => acc + (line.count ?? 0), 0) ?? 0,
    [diff],
  );

  const openInIdeSelection = useKartonState(
    (s) => s.globalConfig.openFilesInIde,
  );

  const streaming = useMemo(() => {
    return part.state === 'input-streaming' || part.state === 'input-available';
  }, [part.state]);

  const state = useMemo(() => {
    if (streaming) return 'streaming';
    if (part.state === 'output-error') return 'error';
    return 'success';
  }, [part.state, streaming]);

  const path = useMemo(() => {
    if (!part.input?.relative_path) return null;
    return part.input?.relative_path;
  }, [part.input?.relative_path]);

  const effectiveExpanded = useMemo(() => {
    return state === 'error' ? false : expanded;
  }, [state, expanded]);

  const trigger = useMemo(() => {
    if (state === 'error')
      return (
        <ErrorHeader
          relativePath={path ?? undefined}
          errorText={part.errorText ?? undefined}
        />
      );
    else if (streaming)
      return <LoadingHeader relativePath={path ?? undefined} />;
    else
      return (
        <SuccessHeader
          relativePath={path ?? undefined}
          newLineCount={newLineCount}
          deletedLineCount={deletedLineCount}
          fileWasCreated={outputWithDiff?._diff?.before === null}
        />
      );
  }, [state, streaming, path, newLineCount, deletedLineCount]);

  const content = useMemo(() => {
    if (state === 'error') return undefined;
    else if (state === 'success' && diff)
      return (
        <DiffPreview
          diff={diff}
          filePath={part.input?.relative_path ?? ''}
          collapsed={codeDiffCollapsed}
        />
      );
    else if (streaming && part.input?.content && !diff)
      return (
        <StreamingCodeBlock
          code={part.input?.content ?? ''}
          language={getLanguageFromPath(part.input?.relative_path)}
        />
      );
    else return undefined;
  }, [state, diff, part.input?.content, part.input?.relative_path, streaming]);

  const contentFooter = useMemo(() => {
    if (state === 'success' && diff)
      return (
        <div className="flex w-full flex-row items-center justify-between">
          <Tooltip>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setCodeDiffCollapsed(!codeDiffCollapsed);
                }}
              >
                {codeDiffCollapsed ? (
                  <ListChevronsUpDownIcon className={cn('size-3 shrink-0')} />
                ) : (
                  <ListChevronsDownUpIcon className={cn('size-3 shrink-0')} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {codeDiffCollapsed ? 'Expand code diff' : 'Collapse code diff'}
            </TooltipContent>
          </Tooltip>
          {(() => {
            const relPath = part.input?.relative_path ?? '';
            const ideName = IDE_SELECTION_ITEMS[openInIdeSelection];
            const anchor = (
              <a
                href={needsIdePicker ? '#' : getFileIDEHref(relPath)}
                target={needsIdePicker ? undefined : '_blank'}
                rel="noopener noreferrer"
                onClick={needsIdePicker ? (e) => e.preventDefault() : undefined}
                className={cn(
                  buttonVariants({ size: 'xs', variant: 'ghost' }),
                  'shrink-0',
                )}
              >
                <div className="flex flex-row items-center justify-center gap-1">
                  <IdeLogo
                    ide={openInIdeSelection}
                    className="size-3 shrink-0"
                  />
                  <span className="text-xs">Open file</span>
                </div>
              </a>
            );
            if (needsIdePicker) {
              return (
                <IdePickerPopover
                  onSelect={(ide) => pickIdeAndOpen(ide, relPath)}
                >
                  {anchor}
                </IdePickerPopover>
              );
            }
            return (
              <Tooltip>
                <TooltipTrigger>{anchor}</TooltipTrigger>
                <TooltipContent>
                  <div className="flex max-w-96 flex-col gap-1">
                    <div className="break-all font-mono text-xs">{relPath}</div>
                    <div className="text-muted-foreground text-xs">
                      Click to open in {ideName}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })()}
        </div>
      );
    else return undefined;
  }, [
    state,
    codeDiffCollapsed,
    part.input?.relative_path,
    openInIdeSelection,
    needsIdePicker,
    getFileIDEHref,
    pickIdeAndOpen,
  ]);

  return (
    <ToolPartUI
      showBorder={true}
      expanded={effectiveExpanded}
      setExpanded={setExpanded}
      trigger={trigger}
      content={content}
      contentClassName={cn(streaming ? 'max-h-24' : 'max-h-56')}
      contentFooter={contentFooter}
      contentFooterClassName="px-0"
    />
  );
};

const ErrorHeader = ({
  relativePath,
  errorText,
}: {
  relativePath?: string;
  errorText?: string;
}) => {
  const errorTextContent = errorText
    ? errorText
    : relativePath
      ? `Error editing ${relativePath}`
      : 'Error editing file';

  return (
    <div className="flex flex-row items-center justify-start gap-1">
      <XIcon className="size-3 shrink-0" />
      <Tooltip>
        <TooltipTrigger>
          <span className="min-w-0 flex-1 truncate text-xs">
            {errorTextContent}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{errorTextContent}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

const SuccessHeader = ({
  relativePath,
  newLineCount,
  deletedLineCount,
  fileWasCreated,
}: {
  relativePath?: string;
  newLineCount: number;
  deletedLineCount: number;
  fileWasCreated: boolean;
}) => {
  const fileName = relativePath?.split('/').pop() ?? relativePath;

  return (
    <div className="pointer-events-none flex flex-row items-center justify-start gap-1">
      <div className="pointer-events-auto flex flex-row items-center justify-start gap-1">
        <FileIcon filePath={relativePath ?? ''} className="size-5 shrink-0" />
        <Tooltip>
          <TooltipTrigger>
            <span className="min-w-0 truncate text-xs" dir="rtl">
              <span
                className="items-center gap-0.5 text-foreground text-xs group-hover/trigger:text-hover-derived"
                dir="ltr"
              >
                {fileName}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent>{relativePath ?? ''}</TooltipContent>
        </Tooltip>
      </div>
      {fileWasCreated && (
        <span className="shrink-0 text-success-foreground text-xs group-hover/trigger:text-hover-derived">
          (new)
        </span>
      )}
      <span className="shrink-0 text-success-foreground text-xs group-hover/trigger:text-hover-derived">
        +{newLineCount}
      </span>
      {!fileWasCreated && deletedLineCount > 0 && (
        <span className="shrink-0 text-error-foreground text-xs group-hover/trigger:text-hover-derived">
          -{deletedLineCount}
        </span>
      )}
    </div>
  );
};

const LoadingHeader = ({ relativePath }: { relativePath?: string }) => {
  const fileName = relativePath?.split('/').pop() ?? relativePath;

  return (
    <div className="flex flex-row items-center justify-start gap-1">
      <Loader2Icon
        className={cn('size-3 shrink-0 animate-spin text-primary-foreground')}
      />
      {relativePath !== null ? (
        <Tooltip>
          <TooltipTrigger>
            <span className="min-w-0 flex-1 truncate text-xs" dir="rtl">
              <span dir="ltr" className="shimmer-text-primary">
                {fileName}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent>{relativePath ?? ''}</TooltipContent>
        </Tooltip>
      ) : (
        <Skeleton className="h-3 w-16" variant="text" />
      )}
    </div>
  );
};
