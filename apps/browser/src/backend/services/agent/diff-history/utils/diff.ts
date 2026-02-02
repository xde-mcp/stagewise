import { randomUUID } from 'node:crypto';
import {
  diffLines,
  structuredPatch,
  formatPatch,
  reversePatch,
  applyPatch,
} from 'diff';
import type { Contributor, Operation } from '../schema';
import type { FileDiff, BlamedLineChange, BlamedHunk } from '../types';

type FileId = string;
/**
 * Segments operations into 'generations' — distinct lifecycles of files separated by
 * deletion and recreation events. Each generation gets a unique fileId.
 *
 * A new generation starts after an edit operation with snapshot_oid=null (file deletion).
 * The deletion edit belongs to the ending generation; subsequent operations start a new one.
 *
 * This function is defensive: it groups operations by filepath first, even though it
 * typically receives operations for a single filepath.
 *
 * IMPORTANT: It's not guarenteed that each generation starts with an 'init' baseline! If a file was deleted, a new generation might start with an 'edit' operation.
 * We can assume that each generation without an 'init' baseline has an empty string as baseline.
 *
 * @param operations - Ordered operations (should be for a single filepath, but handles multiple defensively)
 * @returns Array of generations, each with a unique fileId and its operations
 */
export function segmentFileOperationsIntoGenerations(
  operations: Operation[],
): Record<FileId, Operation[]> {
  if (operations.length === 0) return {};

  // Step 1: Group operations by filepath (defensive)
  const opsByFilepath: Record<string, Operation[]> = {};
  for (const op of operations) {
    const existing = opsByFilepath[op.filepath] ?? [];
    existing.push(op);
    opsByFilepath[op.filepath] = existing;
  }

  // Step 2: For each filepath, segment into generations
  const result: Record<FileId, Operation[]> = {};

  for (const filepath of Object.keys(opsByFilepath)) {
    const fileOps = opsByFilepath[filepath];
    let currentGeneration: Operation[] = [];
    let wasDeleted = false;

    for (const op of fileOps) {
      // If we previously saw a deletion and now have a new op, start new generation
      if (wasDeleted) {
        // Save the previous generation (if it has ops)
        if (currentGeneration.length > 0)
          result[randomUUID()] = currentGeneration;

        // Start new generation
        currentGeneration = [];
        wasDeleted = false;
      }

      // Add current op to current generation
      currentGeneration.push(op);

      // Check if this op marks a deletion (null snapshot_oid)
      // This handles both:
      // - edit with null: agent deleted the file
      // - init baseline with null: user deleted the file between sessions
      if (op.snapshot_oid === null) wasDeleted = true;
    }

    // Don't forget the last generation
    if (currentGeneration.length > 0) {
      result[randomUUID()] = currentGeneration;
    }
  }

  return result;
}

type OperationWithContent = Operation & { snapshot_content: string };

/**
 * Builds a contributor map for each generation, showing which contributor
 * is responsible for each line in the final content.
 *
 * Algorithm:
 * 1. If generation starts with 'init' baseline, use its content as the baseline (no attribution)
 * 2. If generation doesn't start with 'init', baseline is empty string
 * 3. Process remaining operations sequentially:
 *    - For baselines: attribute added lines to 'user' (per spec A: session boundaries)
 *    - For edits: attribute added lines to the edit's contributor
 * 4. For snapshot_oid=null, treat content as empty string (all lines removed)
 *
 * @param generations - Record of fileId to operations with resolved snapshot content
 * @returns Record of fileId to line number → contributor mapping (0-indexed)
 */
export function buildContributorMap(
  generations: Record<FileId, OperationWithContent[]>,
): Record<FileId, { [lineNumber: number]: Contributor }> {
  const result: Record<FileId, { [lineNumber: number]: Contributor }> = {};

  for (const fileId of Object.keys(generations)) {
    const operations = generations[fileId];
    if (operations.length === 0) {
      result[fileId] = {};
      continue;
    }

    // Track contributors per line (array where index = line number)
    let lineContributors: Contributor[] = [];
    let previousContent = '';

    // Check if first operation is an 'init' baseline
    const firstOp = operations[0];
    const startsWithInit =
      firstOp.operation === 'baseline' && firstOp.reason === 'init';

    // Determine starting index for processing
    let startIndex = 0;
    if (startsWithInit) {
      // First init is the baseline - set previousContent but don't process for attribution
      previousContent = firstOp.snapshot_content ?? '';
      // Initialize lineContributors with undefined/placeholder for baseline lines
      // These lines exist but weren't "added" by anyone in this generation
      const baselineLines = previousContent
        ? previousContent.split('\n').length
        : 0;
      // We need to track these lines but they have no contributor yet
      // We'll use 'user' as the default for baseline lines
      lineContributors = Array(baselineLines).fill('user' as Contributor);
      startIndex = 1;
    }

    // Process remaining operations
    for (let i = startIndex; i < operations.length; i++) {
      const op = operations[i];
      const currentContent = op.snapshot_content ?? '';

      // Determine contributor for this operation
      // Baselines (including subsequent inits per spec A) → 'user'
      // Edits → the edit's contributor
      const contributor: Contributor =
        op.operation === 'baseline' ? 'user' : op.contributor;

      // Diff previous content vs current content
      const diffResults = diffLines(previousContent, currentContent, {
        oneChangePerToken: true,
      });

      // Walk through diff results and update lineContributors
      let lineIndex = 0;
      for (const diffResult of diffResults) {
        if (diffResult.added) {
          // Added lines: splice in with this contributor
          const addedLines = diffResult.value.split('\n');
          // diffLines includes trailing newline in count, but split adds empty string
          // Use diffResult.count for accurate line count
          const lineCount = diffResult.count ?? addedLines.length;
          const contributorsToAdd = Array(lineCount).fill(contributor);
          lineContributors.splice(lineIndex, 0, ...contributorsToAdd);
          lineIndex += lineCount;
        } else if (diffResult.removed) {
          // Removed lines: splice out from lineContributors
          const lineCount = diffResult.count ?? 0;
          lineContributors.splice(lineIndex, lineCount);
          // Don't advance lineIndex - we removed lines at this position
        } else {
          // Unchanged lines: advance index, keep existing attribution
          const lineCount = diffResult.count ?? 0;
          lineIndex += lineCount;
        }
      }

      previousContent = currentContent;
    }

    // Convert array to map
    const contributorMap: { [lineNumber: number]: Contributor } = {};
    for (let i = 0; i < lineContributors.length; i++)
      contributorMap[i] = lineContributors[i];

    result[fileId] = contributorMap;
  }

  return result;
}

/**
 * Helper type for hunk range tracking
 */
type HunkRange = {
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
  hunkId: string;
};

/**
 * Finds the hunk ID for a given line position.
 * For added lines, checks if the new line position falls within a hunk's new range.
 * For removed lines, checks if the old line position falls within a hunk's old range.
 *
 * @param hunkRanges - Array of hunk ranges with their IDs
 * @param oldLine - Current position in old content (1-indexed)
 * @param newLine - Current position in new content (1-indexed)
 * @param isAdded - Whether this is an added line (true) or removed line (false)
 * @returns The hunk ID if found, null otherwise
 */
function findHunkId(
  hunkRanges: HunkRange[],
  oldLine: number,
  newLine: number,
  isAdded: boolean | undefined,
): string | null {
  for (const range of hunkRanges) {
    if (isAdded && newLine >= range.newStart && newLine <= range.newEnd)
      return range.hunkId;
    else if (oldLine >= range.oldStart && oldLine <= range.oldEnd)
      return range.hunkId;
  }
  return null;
}

/**
 * Creates FileDiff objects from generations and their contributor maps.
 * Uses diffLines for full file diff (lineChanges) and structuredPatch for hunks.
 *
 * @param generations - Record of fileId to operations with resolved snapshot content
 * @param contributorMap - Record of fileId to line number → contributor mapping
 * @returns Array of FileDiff objects, one per generation
 */
export function createFileDiffsFromGenerations(
  generations: Record<FileId, OperationWithContent[]>,
  contributorMap: Record<FileId, { [lineNumber: number]: Contributor }>,
): FileDiff[] {
  const result: FileDiff[] = [];

  for (const fileId of Object.keys(generations)) {
    const operations = generations[fileId];
    if (operations.length === 0) continue;

    const firstOp = operations[0];
    const lastOp = operations[operations.length - 1];

    // Determine baseline: null if file didn't exist, otherwise content
    const startsWithInit =
      firstOp.operation === 'baseline' && firstOp.reason === 'init';
    const baseline: string | null = startsWithInit
      ? firstOp.snapshot_oid === null
        ? null
        : (firstOp.snapshot_content ?? '')
      : null; // No init = file didn't exist at generation start

    // Determine current: null if file was deleted, otherwise content
    const current: string | null =
      lastOp.snapshot_oid === null ? null : (lastOp.snapshot_content ?? '');

    // Filepath from first operation
    const path = firstOp.filepath;

    // For diffing, convert null to '' (diff functions expect strings)
    const diffBaseline = baseline ?? '';
    const diffCurrent = current ?? '';

    // Step 3: Generate hunks with IDs using structuredPatch
    const patch = structuredPatch('', '', diffBaseline, diffCurrent, '', '');
    const hunks: BlamedHunk[] = patch.hunks.map((hunk) => ({
      ...hunk,
      id: randomUUID(),
    }));

    // Build hunk ranges for lookup
    const hunkRanges: HunkRange[] = hunks.map((h) => ({
      oldStart: h.oldStart,
      oldEnd: h.oldStart + h.oldLines - 1,
      newStart: h.newStart,
      newEnd: h.newStart + h.newLines - 1,
      hunkId: h.id,
    }));

    // Step 4: Get full diff using diffLines
    const changes = diffLines(diffBaseline, diffCurrent, {
      oneChangePerToken: true,
    });

    // Step 5 & 6: Walk through changes, assign hunkIds and contributors
    let oldLine = 1; // 1-indexed to match structuredPatch
    let newLine = 1;
    const lineChanges: BlamedLineChange[] = [];
    const fileContributorMap = contributorMap[fileId] ?? {};

    for (const change of changes) {
      const lineCount = change.count ?? 0;
      let hunkId: string | null = null;

      if (change.added || change.removed) {
        // Find matching hunk for added/removed lines
        hunkId = findHunkId(hunkRanges, oldLine, newLine, change.added);
      }

      // Determine contributor:
      // - For removed lines: use 'user' as fallback (we don't track old content contributors)
      // - For added/unchanged lines: lookup from contributorMap using new content line number
      const contributor: Contributor = change.removed
        ? 'user'
        : (fileContributorMap[newLine - 1] ?? 'user'); // -1 for 0-indexed

      lineChanges.push({
        ...change,
        hunkId,
        contributor,
      });

      // Advance line counters
      if (!change.added) oldLine += lineCount;
      if (!change.removed) newLine += lineCount;
    }

    // Step 7: Assemble FileDiff object
    result.push({
      fileId,
      path,
      baseline,
      current,
      lineChanges,
      hunks,
    });
  }

  return result;
}

type FilePath = string;
/**
 * Accepts and rejects hunks for each file in the fileDiffs and return the new baseline and current for each file.
 * Accepted hunks will move the baseline closer to the current and rejected hunks will move the current closer to the baseline.
 *
 * Hunks will be accepted/ rejected in order of the fileDiffs first, and then by the order of the hunkIdsToAccept and hunkIdsToReject. If the same ID is accepted and rejected, the hunk will be accepted.
 * If accepted hunks of different generations (file-ids) modify the same file-path, the latest accept/ reject will win.
 * - example:
 *   - FileDiff 1 with hunkId '1' deletes readme.md
 *   - FileDiff 2 with hunkId '2' creates readme.md with content 'Hello, world!'
 *   - acceptedHunkIds: ['1', '2']
 *   - result: { '/readme.md': { newBaseline: 'Hello, world!' } }
 *
 */
export function acceptAndRejectHunks(
  fileDiffs: FileDiff[],
  hunkIdsToAccept: string[],
  hunkIdsToReject: string[],
): Record<
  FilePath,
  { newBaseline?: string | null; newCurrent?: string | null }
> & { failedAcceptedHunkIds?: string[]; failedRejectedHunkIds?: string[] } {
  // Step 1: Build accept/reject sets with precedence (accept wins)
  const acceptSet = new Set(hunkIdsToAccept);
  const rejectSet = new Set(hunkIdsToReject.filter((id) => !acceptSet.has(id)));

  // Result tracking
  const pathResults: Record<
    FilePath,
    { newBaseline?: string | null; newCurrent?: string | null }
  > = {};
  const failedAcceptedHunkIds: string[] = [];
  const failedRejectedHunkIds: string[] = [];

  // Step 3: Process each FileDiff in order
  for (const fileDiff of fileDiffs) {
    // Get hunks to accept/reject for this FileDiff, preserving original order
    const hunksToAccept = fileDiff.hunks.filter((h) => acceptSet.has(h.id));
    const hunksToReject = fileDiff.hunks.filter((h) => rejectSet.has(h.id));

    // Skip if no hunks to process for this FileDiff
    if (hunksToAccept.length === 0 && hunksToReject.length === 0) continue;

    // Get working copies of baseline/current (convert null to '' for diffing)
    const diffBaseline = fileDiff.baseline ?? '';
    const diffCurrent = fileDiff.current ?? '';

    // Track whether we've modified baseline/current
    let workingBaseline: string | null = fileDiff.baseline;
    let workingCurrent: string | null = fileDiff.current;
    let baselineChanged = false;
    let currentChanged = false;

    // Step 4: Apply accepts (batch with fallback)
    if (hunksToAccept.length > 0) {
      // Build patch structure for accepted hunks
      const basePatch = structuredPatch(
        '',
        '',
        diffBaseline,
        diffCurrent,
        '',
        '',
      );
      const acceptPatch = { ...basePatch, hunks: hunksToAccept };
      const patchString = formatPatch(acceptPatch);

      // Try batch apply first
      const workingBaselineStr = workingBaseline ?? '';
      const result = applyPatch(workingBaselineStr, patchString);

      if (result !== false) {
        workingBaseline = result;
        baselineChanged = true;
      } else {
        // Fallback: apply one-by-one to identify failures
        let currentWorkingBaseline = workingBaselineStr;
        for (const hunk of hunksToAccept) {
          const singlePatch = { ...basePatch, hunks: [hunk] };
          const singlePatchString = formatPatch(singlePatch);
          const singleResult = applyPatch(
            currentWorkingBaseline,
            singlePatchString,
          );

          if (singleResult !== false) {
            currentWorkingBaseline = singleResult;
            baselineChanged = true;
          } else failedAcceptedHunkIds.push(hunk.id);
        }
        workingBaseline = currentWorkingBaseline;
      }
    }

    // Step 5: Apply rejects (batch with fallback)
    if (hunksToReject.length > 0) {
      // Build reversed patch structure for rejected hunks
      const basePatch = structuredPatch(
        '',
        '',
        diffBaseline,
        diffCurrent,
        '',
        '',
      );
      const rejectPatch = { ...basePatch, hunks: hunksToReject };
      const reversedPatch = reversePatch(rejectPatch);
      const patchString = formatPatch(reversedPatch);

      // Try batch apply first
      const workingCurrentStr = workingCurrent ?? '';
      const result = applyPatch(workingCurrentStr, patchString);

      if (result !== false) {
        workingCurrent = result;
        currentChanged = true;
      } else {
        // Fallback: apply one-by-one to identify failures
        let currentWorkingCurrent = workingCurrentStr;
        for (const hunk of hunksToReject) {
          const singlePatch = { ...basePatch, hunks: [hunk] };
          const reversedSingle = reversePatch(singlePatch);
          const singlePatchString = formatPatch(reversedSingle);
          const singleResult = applyPatch(
            currentWorkingCurrent,
            singlePatchString,
          );

          if (singleResult !== false) {
            currentWorkingCurrent = singleResult;
            currentChanged = true;
          } else {
            failedRejectedHunkIds.push(hunk.id);
          }
        }
        workingCurrent = currentWorkingCurrent;
      }
    }

    // Step 6: Store results per filepath (later FileDiffs overwrite earlier)
    if (baselineChanged || currentChanged) {
      pathResults[fileDiff.path] = {
        ...pathResults[fileDiff.path],
        ...(baselineChanged && { newBaseline: workingBaseline }),
        ...(currentChanged && { newCurrent: workingCurrent }),
      };
    }
  }

  // Build final result with optional failure arrays
  const finalResult: Record<
    FilePath,
    { newBaseline?: string | null; newCurrent?: string | null }
  > & { failedAcceptedHunkIds?: string[]; failedRejectedHunkIds?: string[] } = {
    ...pathResults,
  };

  if (failedAcceptedHunkIds.length > 0)
    finalResult.failedAcceptedHunkIds = failedAcceptedHunkIds;

  if (failedRejectedHunkIds.length > 0)
    finalResult.failedRejectedHunkIds = failedRejectedHunkIds;

  return finalResult;
}
