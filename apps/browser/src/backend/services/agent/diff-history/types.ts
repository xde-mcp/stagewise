import type { ChangeObject, StructuredPatchHunk } from 'diff';
import type { Contributor } from './schema';

export type BlamedLineChange = ChangeObject<string> & {
  hunkId: string | null; // null if the line change is not part of a hunk
  contributor: Contributor;
};

export type BlamedHunk = StructuredPatchHunk & {
  id: string;
};

export type FileDiff = {
  fileId: string; // generated in the 'computeDiffs' step, used to identify 'delete' -> 'create' changes with the same file path, so the UI can display them separately and will not accidentally merge them into a single change
  path: string; // TODO: Decide whether absolute or relative
  baseline: string | null; // null = file didn't exist at baseline, '' = file exists but is empty
  current: string | null; // null = file was deleted, '' = file exists but is empty
  lineChanges: BlamedLineChange[];
  hunks: BlamedHunk[];
};

/**  Flow for computing a file diff in the backend, showing the diff to the UI, up to accepting/ rejecting the hunks from the UI:
 * - Backend computes 'FileDiff' object for a file
 * - UI displays the diff based on 'lineChanges'
 * - UI allows accepting/ rejecting hunks via buttons -> group lines by hunkId and display accept/ reject buttons for each hunk
 * - UI sends accepted/ rejected hunk ids to the backend
 * */
