import { Button } from '@stagewise/stage-ui/components/button';
import type { FileDiff } from '@shared/karton-contracts/ui/shared-types';
import { ChevronDownIcon } from 'lucide-react';
import { FileIcon } from '@/components/file-icon';
import { cn } from '@/utils';
import { getBaseName } from '@shared/path-utils';
import {
  type StatusCardSection,
  type FormattedFileDiff,
  getLineStats,
  getHunkIds,
  hasRealChanges,
} from './shared';

export interface FileDiffSectionProps {
  pendingDiffs: FormattedFileDiff[];
  diffSummary: FormattedFileDiff[];
  onRejectAll: (hunkIds: string[]) => void;
  onAcceptAll: (hunkIds: string[]) => void;
  onOpenDiffReview: (fileId: string) => void;
}

export function formatFileDiff(fileDiff: FileDiff): FormattedFileDiff {
  return {
    ...fileDiff,
    fileName: getBaseName(fileDiff.path),
  };
}

export function FileDiffFileItem({
  fileDiff,
  onOpenDiffReview,
}: {
  fileDiff: FormattedFileDiff;
  onOpenDiffReview: (fileId: string) => void;
}) {
  const { added, removed } = getLineStats(fileDiff);

  return (
    <button
      type="button"
      className="flex w-full cursor-pointer flex-col items-start justify-start gap-2 rounded px-1 py-0.5 text-foreground hover:bg-surface-1 hover:text-hover-derived"
      onClick={() => onOpenDiffReview(fileDiff.fileId)}
    >
      <span className="flex flex-row items-center justify-start gap-1 truncate text-xs">
        <FileIcon filePath={fileDiff.fileName} className="size-5 shrink-0" />
        <span className="text-xs leading-none">{fileDiff.fileName}</span>
        {fileDiff.isExternal ? (
          <>
            {fileDiff.changeType === 'created' && (
              <span className="text-[10px] text-success-foreground leading-none">
                (new)
              </span>
            )}
            {fileDiff.changeType === 'deleted' && (
              <span className="text-[10px] text-error-foreground leading-none">
                (deleted)
              </span>
            )}
            {fileDiff.changeType === 'modified' && (
              <span className="text-[10px] text-muted-foreground leading-none">
                (binary)
              </span>
            )}
          </>
        ) : (
          <>
            {added > 0 && (
              <span className="text-[10px] text-success-foreground leading-none hover:text-hover-derived">
                +{added}
              </span>
            )}
            {removed > 0 && (
              <span className="text-[10px] text-error-foreground leading-none hover:text-hover-derived">
                -{removed}
              </span>
            )}
          </>
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

  // Filter out noops from summary (rejected edits with no actual changes)
  const filteredSummary = diffSummary.filter(hasRealChanges);

  if (pendingDiffs?.length === 0 && filteredSummary.length === 0) return null;

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
            {filteredSummary.length} Edit
            {filteredSummary.length > 1 ? 's' : ''}
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
                  pendingDiffs?.flatMap((diff) => getHunkIds(diff)) ?? [],
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
                  pendingDiffs?.flatMap((diff) => getHunkIds(diff)) ?? [],
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
    scrollable: true,
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
          : filteredSummary.length > 0
            ? filteredSummary.map((edit) => (
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
