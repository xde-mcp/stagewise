import { Button } from '@stagewise/stage-ui/components/button';
import type { FileDiff } from '@shared/karton-contracts/ui/shared-types';
import { ChevronDownIcon } from 'lucide-react';
import { FileIcon } from '../message-part-ui/tools/shared/file-icon';
import { cn } from '@/utils';
import { diffLines } from 'diff';
import type { StatusCardSection, FormattedFileDiff } from './shared';

export interface FileDiffSectionProps {
  pendingDiffs: FormattedFileDiff[];
  diffSummary: FormattedFileDiff[];
  onRejectAll: (hunkIds: string[]) => void;
  onAcceptAll: (hunkIds: string[]) => void;
  onOpenDiffReview: (fileId: string) => void;
}

export function formatFileDiff(fileDiff: FileDiff): FormattedFileDiff {
  const diff =
    fileDiff.isExternal === true
      ? diffLines('', '')
      : diffLines(fileDiff.baseline ?? '', fileDiff.current ?? '');
  const fileName = fileDiff.path.split('/').pop() ?? '';
  const linesAdded = diff.reduce(
    (acc, line) => acc + (line.added ? line.count : 0),
    0,
  );
  const linesRemoved = diff.reduce(
    (acc, line) => acc + (line.removed ? line.count : 0),
    0,
  );
  const hunkIds =
    fileDiff.isExternal === true
      ? [fileDiff.hunkId]
      : fileDiff.hunks.map((hunk) => hunk.id);
  return {
    fileId: fileDiff.fileId,
    path: fileDiff.path,
    fileName,
    linesAdded,
    linesRemoved,
    hunkIds,
  };
}

function FileDiffFileItem({
  fileDiff,
  onOpenDiffReview,
}: {
  fileDiff: FormattedFileDiff;
  onOpenDiffReview: (fileId: string) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full cursor-pointer flex-col items-start justify-start gap-2 rounded px-1 py-0.5 text-foreground hover:bg-surface-1 hover:text-hover-derived"
      onClick={() => onOpenDiffReview(fileDiff.fileId)}
    >
      <span className="flex flex-row items-center justify-start gap-1 truncate text-xs">
        <FileIcon filePath={fileDiff.fileName} className="size-5 shrink-0" />
        <span className="text-xs leading-none">{fileDiff.fileName}</span>
        {fileDiff.linesAdded > 0 && (
          <span className="text-[10px] text-success-foreground leading-none hover:text-hover-derived">
            +{fileDiff.linesAdded}
          </span>
        )}
        {fileDiff.linesRemoved > 0 && (
          <span className="text-[10px] text-error-foreground leading-none hover:text-hover-derived">
            -{fileDiff.linesRemoved}
          </span>
        )}
      </span>
    </button>
  );
}

export function FileDiffSection(
  props: FileDiffSectionProps,
): StatusCardSection | null {
  const {
    pendingDiffs,
    diffSummary,
    onRejectAll,
    onAcceptAll,
    onOpenDiffReview,
  } = props;

  if (pendingDiffs?.length === 0 && diffSummary?.length === 0) return null;

  const hasPendingDiffs = pendingDiffs?.length > 0;

  return {
    // Change key when transitioning from pending to summary - forces remount with new defaultOpen
    key: hasPendingDiffs ? 'file-diff-pending' : 'file-diff-summary',
    // Expand when there are pending diffs to review, collapse for summary view
    defaultOpen: hasPendingDiffs,
    trigger: (isOpen: boolean) => (
      <div className="flex w-full flex-row items-center justify-between gap-2 pl-1.5 text-muted-foreground text-xs hover:text-foreground has-[button:hover]:text-muted-foreground">
        <ChevronDownIcon
          className={cn(
            'size-3 shrink-0 transition-transform duration-50',
            isOpen && 'rotate-180',
          )}
        />
        {pendingDiffs?.length > 0 ? (
          `${pendingDiffs.length} Edit${pendingDiffs.length > 1 ? 's' : ''}`
        ) : (
          <span>
            {diffSummary.length} Edit{diffSummary.length > 1 ? 's' : ''}
          </span>
        )}

        {pendingDiffs?.length > 0 ? (
          <div className="ml-auto flex flex-row items-center justify-start gap-1">
            <Button
              variant="ghost"
              size="xs"
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onRejectAll(
                  pendingDiffs?.flatMap((diff) => diff.hunkIds) ?? [],
                );
              }}
            >
              Reject
            </Button>
            <Button
              variant="primary"
              size="xs"
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onAcceptAll(
                  pendingDiffs?.flatMap((diff) => diff.hunkIds) ?? [],
                );
              }}
            >
              Accept all
            </Button>
          </div>
        ) : (
          <div className="ml-auto h-6" />
        )}
      </div>
    ),
    contentClassName: 'px-0',
    content: (
      <div className="pt-1">
        {pendingDiffs?.length > 0
          ? pendingDiffs?.map((edit) => (
              <FileDiffFileItem
                key={edit.path}
                fileDiff={edit}
                onOpenDiffReview={onOpenDiffReview}
              />
            ))
          : diffSummary?.length > 0
            ? diffSummary?.map((edit) => (
                <FileDiffFileItem
                  key={edit.path}
                  fileDiff={edit}
                  onOpenDiffReview={onOpenDiffReview}
                />
              ))
            : null}
      </div>
    ),
  };
}
