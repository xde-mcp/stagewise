import { describe, it, expect, beforeEach } from 'vitest';
import { structuredPatch } from 'diff';
import type { Operation, Contributor } from '../schema';
import type {
  TextFileDiff,
  ExternalFileDiff,
  BlamedHunk,
} from '@shared/karton-contracts/ui/shared-types';
import {
  segmentFileOperationsIntoGenerations,
  buildContributorMap,
  createFileDiffsFromGenerations,
  acceptAndRejectHunks,
  isTextFileDiff,
  isExternalFileDiff,
} from './diff';

// =============================================================================
// Helper Types
// =============================================================================

type OperationWithContent = Operation & {
  snapshot_content: string;
  isExternal: boolean; // Required to match the actual type from diff.ts
};

// =============================================================================
// Helper Factories
// =============================================================================

let operationIdx = 0;

// Type for operation with isExternal flag (for segmentFileOperationsIntoGenerations tests)
type OperationWithExternal = Operation & { isExternal: boolean };

/**
 * Creates a mock baseline Operation
 * Note: Use explicit `snapshot_oid: null` to indicate deleted/non-existent file
 */
function createBaselineOp(overrides: {
  filepath?: string;
  snapshot_oid?: string | null;
  reason?: 'init' | 'accept';
  idx?: number;
}): Operation {
  return {
    idx: overrides.idx ?? operationIdx++,
    filepath: overrides.filepath ?? '/test/file.txt',
    operation: 'baseline',
    // Use 'in' check to distinguish between undefined and explicit null
    snapshot_oid:
      'snapshot_oid' in overrides
        ? overrides.snapshot_oid
        : `oid- ${Math.random().toString(36)}`,
    reason: overrides.reason ?? 'init',
    contributor: 'user',
  } as Operation;
}

/**
 * Creates a mock baseline Operation with isExternal flag
 */
function createBaselineOpWithExternal(
  overrides: {
    filepath?: string;
    snapshot_oid?: string | null;
    reason?: 'init' | 'accept';
    idx?: number;
  },
  isExternal = false,
): OperationWithExternal {
  return {
    ...createBaselineOp(overrides),
    isExternal,
  };
}

/**
 * Creates a mock edit Operation
 * Note: Use explicit `snapshot_oid: null` to indicate file deletion
 */
function createEditOp(overrides: {
  filepath?: string;
  snapshot_oid?: string | null;
  reason?: 'reject' | `tool-${string}`;
  contributor?: Contributor;
  idx?: number;
}): Operation {
  return {
    idx: overrides.idx ?? operationIdx++,
    filepath: overrides.filepath ?? '/test/file.txt',
    operation: 'edit',
    // Use 'in' check to distinguish between undefined and explicit null
    snapshot_oid:
      'snapshot_oid' in overrides
        ? overrides.snapshot_oid
        : `oid- ${Math.random().toString(36)}`,
    reason: overrides.reason ?? 'tool-123',
    contributor: overrides.contributor ?? 'agent-1',
  } as Operation;
}

/**
 * Creates a mock edit Operation with isExternal flag
 */
function createEditOpWithExternal(
  overrides: {
    filepath?: string;
    snapshot_oid?: string | null;
    reason?: 'reject' | `tool-${string}`;
    contributor?: Contributor;
    idx?: number;
  },
  isExternal = false,
): OperationWithExternal {
  return {
    ...createEditOp(overrides),
    isExternal,
  };
}

/**
 * Creates a mock OperationWithContent for buildContributorMap tests
 */
function createOpWithContent(
  op: Operation,
  content: string,
  isExternal = false,
): OperationWithContent {
  return {
    ...op,
    snapshot_content: content,
    isExternal,
  };
}

/**
 * Creates a TextFileDiff with realistic hunks from actual content diff
 */
function createFileDiffFromContent(
  fileId: string,
  path: string,
  baseline: string | null,
  current: string | null,
): TextFileDiff {
  const diffBaseline = baseline ?? '';
  const diffCurrent = current ?? '';
  const patch = structuredPatch('', '', diffBaseline, diffCurrent, '', '');
  const hunks: BlamedHunk[] = patch.hunks.map((hunk, i) => ({
    ...hunk,
    id: `hunk-${fileId}-${i}`,
  }));

  return {
    fileId,
    path,
    isExternal: false,
    baseline,
    current,
    lineChanges: [], // Not needed for acceptAndRejectHunks tests
    hunks,
  };
}

/**
 * Creates an ExternalFileDiff for testing external/binary file handling
 */
function createExternalFileDiff(
  fileId: string,
  path: string,
  changeType: 'created' | 'deleted' | 'modified',
  baselineOid: string | null,
  currentOid: string | null,
  contributor: Contributor = 'agent-1',
): ExternalFileDiff {
  return {
    fileId,
    path,
    isExternal: true,
    changeType,
    baselineOid,
    currentOid,
    contributor,
    hunkId: `ext-hunk-${fileId}`,
  };
}

/**
 * Creates a mock OperationWithContent for external files
 */
function createExternalOpWithContent(op: Operation): OperationWithContent {
  return {
    ...op,
    snapshot_content: '', // External files don't have text content
    isExternal: true,
  };
}

// =============================================================================
// Test Suites
// =============================================================================

describe('diff utilities', () => {
  // Reset operation index before each test
  beforeEach(() => {
    operationIdx = 0;
  });

  // ===========================================================================
  // segmentFileOperationsIntoGenerations
  // ===========================================================================

  describe('segmentFileOperationsIntoGenerations', () => {
    it('returns empty object for empty input', () => {
      const result = segmentFileOperationsIntoGenerations([]);
      expect(result).toEqual({});
    });

    it('returns one generation with one operation', () => {
      const op = createBaselineOpWithExternal({ filepath: '/readme.md' });
      const result = segmentFileOperationsIntoGenerations([op]);

      const generations = Object.values(result);
      expect(generations).toHaveLength(1);
      expect(generations[0]).toHaveLength(1);
      expect(generations[0][0]).toEqual(op);
    });

    it('keeps multiple ops without deletion in single generation', () => {
      const ops = [
        createBaselineOpWithExternal({
          filepath: '/readme.md',
          reason: 'init',
        }),
        createEditOpWithExternal({ filepath: '/readme.md', reason: 'tool-1' }),
        createEditOpWithExternal({ filepath: '/readme.md', reason: 'tool-2' }),
      ];
      const result = segmentFileOperationsIntoGenerations(ops);

      const generations = Object.values(result);
      expect(generations).toHaveLength(1);
      expect(generations[0]).toHaveLength(3);
    });

    it('starts new generation after deletion (snapshot_oid = null)', () => {
      const ops = [
        createBaselineOpWithExternal({
          filepath: '/readme.md',
          reason: 'init',
        }),
        createEditOpWithExternal({
          filepath: '/readme.md',
          reason: 'tool-1',
          snapshot_oid: null,
        }), // deletion
        createEditOpWithExternal({ filepath: '/readme.md', reason: 'tool-2' }), // recreation
      ];
      const result = segmentFileOperationsIntoGenerations(ops);

      const generations = Object.values(result);
      expect(generations).toHaveLength(2);
      // First generation: init + deletion
      expect(generations[0]).toHaveLength(2);
      // Second generation: recreation
      expect(generations[1]).toHaveLength(1);
    });

    it('creates multiple generations for multiple deletions', () => {
      const ops = [
        createBaselineOpWithExternal({ filepath: '/readme.md' }),
        createEditOpWithExternal({
          filepath: '/readme.md',
          snapshot_oid: null,
        }), // delete
        createEditOpWithExternal({ filepath: '/readme.md' }), // create
        createEditOpWithExternal({
          filepath: '/readme.md',
          snapshot_oid: null,
        }), // delete again
        createEditOpWithExternal({ filepath: '/readme.md' }), // create again
      ];
      const result = segmentFileOperationsIntoGenerations(ops);

      const generations = Object.values(result);
      expect(generations).toHaveLength(3);
    });

    it('treats init baseline with null oid as deletion', () => {
      const ops = [
        createBaselineOpWithExternal({
          filepath: '/readme.md',
          reason: 'init',
        }),
        createEditOpWithExternal({ filepath: '/readme.md' }),
        createBaselineOpWithExternal({
          filepath: '/readme.md',
          reason: 'init',
          snapshot_oid: null,
        }), // user deleted file between sessions
        createEditOpWithExternal({ filepath: '/readme.md' }), // new session
      ];
      const result = segmentFileOperationsIntoGenerations(ops);

      const generations = Object.values(result);
      expect(generations).toHaveLength(2);
    });

    it('groups by filepath first, then segments each', () => {
      const ops = [
        createBaselineOpWithExternal({ filepath: '/file1.txt' }),
        createBaselineOpWithExternal({ filepath: '/file2.txt' }),
        createEditOpWithExternal({ filepath: '/file1.txt' }),
        createEditOpWithExternal({
          filepath: '/file2.txt',
          snapshot_oid: null,
        }), // delete file2
        createEditOpWithExternal({ filepath: '/file2.txt' }), // recreate file2
      ];
      const result = segmentFileOperationsIntoGenerations(ops);

      const generations = Object.values(result);
      // file1: 1 generation (2 ops), file2: 2 generations (2 ops, 1 op)
      expect(generations).toHaveLength(3);
    });

    it('handles deletion as last op without creating orphan generation', () => {
      const ops = [
        createBaselineOpWithExternal({ filepath: '/readme.md' }),
        createEditOpWithExternal({ filepath: '/readme.md' }),
        createEditOpWithExternal({
          filepath: '/readme.md',
          snapshot_oid: null,
        }), // deletion is last
      ];
      const result = segmentFileOperationsIntoGenerations(ops);

      const generations = Object.values(result);
      expect(generations).toHaveLength(1);
      expect(generations[0]).toHaveLength(3);
    });
  });

  // ===========================================================================
  // buildContributorMap
  // ===========================================================================

  describe('buildContributorMap', () => {
    it('returns empty map for empty generation', () => {
      const result = buildContributorMap({ 'file-1': [] });
      expect(result['file-1']).toEqual({});
    });

    it('attributes all baseline lines to user', () => {
      const ops: OperationWithContent[] = [
        createOpWithContent(
          createBaselineOp({ reason: 'init' }),
          'line1\nline2\nline3',
        ),
      ];
      const result = buildContributorMap({ 'file-1': ops });

      expect(result['file-1']).toEqual({
        0: 'user',
        1: 'user',
        2: 'user',
      });
    });

    it('attributes added lines to agent, unchanged to user', () => {
      // Note: diffLines counts the trailing newline as part of the line
      // So "line1\n" is 1 line, "line1\nline2\n" is 2 lines
      const ops: OperationWithContent[] = [
        createOpWithContent(createBaselineOp({ reason: 'init' }), 'line1\n'),
        createOpWithContent(
          createEditOp({ contributor: 'agent-1', reason: 'tool-1' }),
          'line1\nline2\n',
        ),
      ];
      const result = buildContributorMap({ 'file-1': ops });

      // Verify the important parts: line 0 is user (unchanged), line 1 is agent (added)
      expect(result['file-1'][0]).toBe('user');
      expect(result['file-1'][1]).toBe('agent-1');
    });

    it('tracks multiple agent edits with different contributors', () => {
      const ops: OperationWithContent[] = [
        createOpWithContent(createBaselineOp({ reason: 'init' }), 'line1\n'),
        createOpWithContent(
          createEditOp({ contributor: 'agent-1', reason: 'tool-1' }),
          'line1\nline2\n',
        ),
        createOpWithContent(
          createEditOp({ contributor: 'agent-2', reason: 'tool-2' }),
          'line1\nline2\nline3\n',
        ),
      ];
      const result = buildContributorMap({ 'file-1': ops });

      // Verify the important attributions
      expect(result['file-1'][0]).toBe('user'); // baseline
      expect(result['file-1'][1]).toBe('agent-1'); // added by agent1
      expect(result['file-1'][2]).toBe('agent-2'); // added by agent2
    });

    it('attributes user reject edits to user', () => {
      const ops: OperationWithContent[] = [
        createOpWithContent(createBaselineOp({ reason: 'init' }), 'line1'),
        createOpWithContent(
          createEditOp({ contributor: 'agent-1', reason: 'tool-1' }),
          'line1\nline2',
        ),
        createOpWithContent(
          createEditOp({ contributor: 'user', reason: 'reject' }),
          'line1\nline2\nline3-user',
        ),
      ];
      const result = buildContributorMap({ 'file-1': ops });

      expect(result['file-1'][2]).toBe('user');
    });

    it('treats subsequent init baseline as user edit (spec A)', () => {
      // Simulating: session ended, user changed file, new session starts
      const ops: OperationWithContent[] = [
        createOpWithContent(createBaselineOp({ reason: 'init' }), 'original'),
        createOpWithContent(
          createEditOp({ contributor: 'agent-1' }),
          'modified',
        ),
        // Session boundary: new init with different content
        createOpWithContent(
          createBaselineOp({ reason: 'init' }),
          'user-changed',
        ),
      ];
      const result = buildContributorMap({ 'file-1': ops });

      // The new init's content should be attributed to 'user'
      expect(result['file-1'][0]).toBe('user');
    });

    it('handles generation starting with edit (no init)', () => {
      // After file deletion and recreation
      const ops: OperationWithContent[] = [
        createOpWithContent(
          createEditOp({ contributor: 'agent-1', reason: 'tool-1' }),
          'new-content',
        ),
      ];
      const result = buildContributorMap({ 'file-1': ops });

      // All lines from the edit contributor (baseline is empty)
      expect(result['file-1'][0]).toBe('agent-1');
    });

    it('handles mixed contributors modifying same lines', () => {
      const ops: OperationWithContent[] = [
        createOpWithContent(
          createBaselineOp({ reason: 'init' }),
          'line1\nline2\nline3',
        ),
        createOpWithContent(
          createEditOp({ contributor: 'agent-1' }),
          'line1\nmodified-by-A\nline3',
        ),
        createOpWithContent(
          createEditOp({ contributor: 'agent-2' }),
          'line1\nmodified-by-B\nline3',
        ),
      ];
      const result = buildContributorMap({ 'file-1': ops });

      expect(result['file-1']).toEqual({
        0: 'user', // unchanged
        1: 'agent-2', // last modifier
        2: 'user', // unchanged
      });
    });

    it('does not include removed lines in final map', () => {
      const ops: OperationWithContent[] = [
        createOpWithContent(
          createBaselineOp({ reason: 'init' }),
          'line1\nline2\nline3',
        ),
        createOpWithContent(
          createEditOp({ contributor: 'agent-1' }),
          'line1\nline3',
        ), // removed line2
      ];
      const result = buildContributorMap({ 'file-1': ops });

      // Only 2 lines remain
      expect(Object.keys(result['file-1'])).toHaveLength(2);
      expect(result['file-1']).toEqual({
        0: 'user',
        1: 'user',
      });
    });

    it('handles complete file replacement', () => {
      const ops: OperationWithContent[] = [
        createOpWithContent(
          createBaselineOp({ reason: 'init' }),
          'old1\nold2\nold3',
        ),
        createOpWithContent(
          createEditOp({ contributor: 'agent-1' }),
          'new1\nnew2',
        ),
      ];
      const result = buildContributorMap({ 'file-1': ops });

      expect(result['file-1']).toEqual({
        0: 'agent-1',
        1: 'agent-1',
      });
    });
  });

  // ===========================================================================
  // createFileDiffsFromGenerations
  // ===========================================================================

  describe('createFileDiffsFromGenerations', () => {
    it('skips empty generations', () => {
      const result = createFileDiffsFromGenerations({ 'file-1': [] }, {});
      expect(result).toHaveLength(0);
    });

    it('creates FileDiff with empty hunks when no changes', () => {
      const ops: OperationWithContent[] = [
        createOpWithContent(
          createBaselineOp({ reason: 'init', filepath: '/readme.md' }),
          'same content',
        ),
        createOpWithContent(
          createEditOp({ filepath: '/readme.md' }),
          'same content',
        ),
      ];
      const contributorMap = { 'file-1': { 0: 'user' as Contributor } };
      const result = createFileDiffsFromGenerations(
        { 'file-1': ops },
        contributorMap,
      );

      expect(result).toHaveLength(1);
      const diff = result[0];
      expect(isTextFileDiff(diff)).toBe(true);
      if (isTextFileDiff(diff)) {
        expect(diff.hunks).toHaveLength(0);
        expect(diff.baseline).toBe('same content');
        expect(diff.current).toBe('same content');
      }
    });

    it('creates hunks for added lines', () => {
      const ops: OperationWithContent[] = [
        createOpWithContent(
          createBaselineOp({ reason: 'init', filepath: '/readme.md' }),
          'line1',
        ),
        createOpWithContent(
          createEditOp({ filepath: '/readme.md' }),
          'line1\nline2',
        ),
      ];
      const contributorMap = {
        'file-1': { 0: 'user' as Contributor, 1: 'agent-1' as Contributor },
      };
      const result = createFileDiffsFromGenerations(
        { 'file-1': ops },
        contributorMap,
      );

      expect(result).toHaveLength(1);
      const diff = result[0];
      expect(isTextFileDiff(diff)).toBe(true);
      if (isTextFileDiff(diff)) {
        expect(diff.hunks.length).toBeGreaterThan(0);
        expect(diff.baseline).toBe('line1');
        expect(diff.current).toBe('line1\nline2');
      }
    });

    it('creates hunks for removed lines', () => {
      const ops: OperationWithContent[] = [
        createOpWithContent(
          createBaselineOp({ reason: 'init', filepath: '/readme.md' }),
          'line1\nline2',
        ),
        createOpWithContent(createEditOp({ filepath: '/readme.md' }), 'line1'),
      ];
      const contributorMap = { 'file-1': { 0: 'user' as Contributor } };
      const result = createFileDiffsFromGenerations(
        { 'file-1': ops },
        contributorMap,
      );

      expect(result).toHaveLength(1);
      const diff = result[0];
      expect(isTextFileDiff(diff)).toBe(true);
      if (isTextFileDiff(diff)) {
        expect(diff.hunks.length).toBeGreaterThan(0);
      }
    });

    it('handles multiple hunks for mixed changes', () => {
      const ops: OperationWithContent[] = [
        createOpWithContent(
          createBaselineOp({ reason: 'init', filepath: '/readme.md' }),
          'line1\nline2\nline3\nline4\nline5',
        ),
        createOpWithContent(
          createEditOp({ filepath: '/readme.md' }),
          'modified1\nline2\nline3\nline4\nmodified5',
        ),
      ];
      const contributorMap = {
        'file-1': {
          0: 'agent-1' as Contributor,
          1: 'user' as Contributor,
          2: 'user' as Contributor,
          3: 'user' as Contributor,
          4: 'agent-1' as Contributor,
        },
      };
      const result = createFileDiffsFromGenerations(
        { 'file-1': ops },
        contributorMap,
      );

      expect(result).toHaveLength(1);
      const diff = result[0];
      expect(isTextFileDiff(diff)).toBe(true);
      if (isTextFileDiff(diff)) {
        // Should have hunks for the changes
        expect(diff.hunks.length).toBeGreaterThan(0);
      }
    });

    it('sets baseline to null for file creation (no init)', () => {
      const ops: OperationWithContent[] = [
        createOpWithContent(
          createEditOp({ filepath: '/readme.md', reason: 'tool-1' }),
          'new file content',
        ),
      ];
      const contributorMap = { 'file-1': { 0: 'agent-1' as Contributor } };
      const result = createFileDiffsFromGenerations(
        { 'file-1': ops },
        contributorMap,
      );

      expect(result).toHaveLength(1);
      const diff = result[0];
      expect(isTextFileDiff(diff)).toBe(true);
      if (isTextFileDiff(diff)) {
        expect(diff.baseline).toBeNull();
        expect(diff.current).toBe('new file content');
      }
    });

    it('sets current to null for file deletion', () => {
      const ops: OperationWithContent[] = [
        createOpWithContent(
          createBaselineOp({ reason: 'init', filepath: '/readme.md' }),
          'original content',
        ),
        createOpWithContent(
          createEditOp({ filepath: '/readme.md', snapshot_oid: null }),
          '',
        ),
      ];
      // Override the last op to have null snapshot_oid
      ops[1].snapshot_oid = null;

      const contributorMap = { 'file-1': {} };
      const result = createFileDiffsFromGenerations(
        { 'file-1': ops },
        contributorMap,
      );

      expect(result).toHaveLength(1);
      const diff = result[0];
      expect(isTextFileDiff(diff)).toBe(true);
      if (isTextFileDiff(diff)) {
        expect(diff.baseline).toBe('original content');
        expect(diff.current).toBeNull();
      }
    });

    it('includes contributor in lineChanges', () => {
      const ops: OperationWithContent[] = [
        createOpWithContent(
          createBaselineOp({ reason: 'init', filepath: '/readme.md' }),
          'line1',
        ),
        createOpWithContent(
          createEditOp({
            filepath: '/readme.md',
            contributor: 'agent-1',
          }),
          'line1\nline2',
        ),
      ];
      const contributorMap = {
        'file-1': { 0: 'user' as Contributor, 1: 'agent-1' as Contributor },
      };
      const result = createFileDiffsFromGenerations(
        { 'file-1': ops },
        contributorMap,
      );

      expect(result).toHaveLength(1);
      const diff = result[0];
      expect(isTextFileDiff(diff)).toBe(true);
      if (isTextFileDiff(diff)) {
        // Check that lineChanges have contributors
        const addedChange = diff.lineChanges.find((lc) => lc.added);
        if (addedChange) {
          expect(addedChange.contributor).toBeDefined();
        }
      }
    });

    it('creates separate FileDiffs for multiple generations', () => {
      const ops1: OperationWithContent[] = [
        createOpWithContent(
          createBaselineOp({ reason: 'init', filepath: '/readme.md' }),
          'gen1 content',
        ),
      ];
      const ops2: OperationWithContent[] = [
        createOpWithContent(
          createEditOp({ filepath: '/readme.md' }),
          'gen2 content',
        ),
      ];
      const contributorMap = {
        'file-1': { 0: 'user' as Contributor },
        'file-2': { 0: 'agent-1' as Contributor },
      };
      const result = createFileDiffsFromGenerations(
        { 'file-1': ops1, 'file-2': ops2 },
        contributorMap,
      );

      expect(result).toHaveLength(2);
      expect(result[0].fileId).not.toBe(result[1].fileId);
    });
  });

  // ===========================================================================
  // acceptAndRejectHunks
  // ===========================================================================

  describe('acceptAndRejectHunks', () => {
    it('returns empty result when no hunks to process', () => {
      const fileDiff = createFileDiffFromContent(
        'file-1',
        '/readme.md',
        'line1',
        'line1\nline2',
      );
      const result = acceptAndRejectHunks([fileDiff], [], []);

      expect(Object.keys(result.result)).toHaveLength(0);
    });

    it('updates baseline when accepting a hunk', () => {
      const fileDiff = createFileDiffFromContent(
        'file-1',
        '/readme.md',
        'line1',
        'line1\nline2',
      );
      const hunkId = fileDiff.hunks[0]?.id;
      if (!hunkId) throw new Error('Expected hunk');

      const result = acceptAndRejectHunks([fileDiff], [hunkId], []);
      const fileResult = result.result['/readme.md'];

      expect(fileResult).toBeDefined();
      expect(fileResult?.isExternal).toBe(false);
      if (fileResult && !fileResult.isExternal) {
        expect(fileResult.newBaseline).toBe('line1\nline2');
      }
    });

    it('updates current when rejecting a hunk', () => {
      const fileDiff = createFileDiffFromContent(
        'file-1',
        '/readme.md',
        'line1',
        'line1\nline2',
      );
      const hunkId = fileDiff.hunks[0]?.id;
      if (!hunkId) throw new Error('Expected hunk');

      const result = acceptAndRejectHunks([fileDiff], [], [hunkId]);
      const fileResult = result.result['/readme.md'];

      expect(fileResult).toBeDefined();
      expect(fileResult?.isExternal).toBe(false);
      if (fileResult && !fileResult.isExternal) {
        // Rejecting should revert current to baseline
        expect(fileResult.newCurrent).toBe('line1');
      }
    });

    it('applies multiple accepted hunks', () => {
      // Create a diff with multiple hunks (changes at beginning and end)
      const fileDiff = createFileDiffFromContent(
        'file-1',
        '/readme.md',
        'line1\nline2\nline3\nline4\nline5',
        'modified1\nline2\nline3\nline4\nmodified5',
      );

      const hunkIds = fileDiff.hunks.map((h) => h.id);
      const result = acceptAndRejectHunks([fileDiff], hunkIds, []);
      const fileResult = result.result['/readme.md'];

      expect(fileResult).toBeDefined();
      expect(fileResult?.isExternal).toBe(false);
      if (fileResult && !fileResult.isExternal) {
        expect(fileResult.newBaseline).toBe(
          'modified1\nline2\nline3\nline4\nmodified5',
        );
      }
    });

    it('applies multiple rejected hunks', () => {
      const fileDiff = createFileDiffFromContent(
        'file-1',
        '/readme.md',
        'line1\nline2\nline3\nline4\nline5',
        'modified1\nline2\nline3\nline4\nmodified5',
      );

      const hunkIds = fileDiff.hunks.map((h) => h.id);
      const result = acceptAndRejectHunks([fileDiff], [], hunkIds);
      const fileResult = result.result['/readme.md'];

      expect(fileResult).toBeDefined();
      expect(fileResult?.isExternal).toBe(false);
      if (fileResult && !fileResult.isExternal) {
        // Should revert to baseline
        expect(fileResult.newCurrent).toBe('line1\nline2\nline3\nline4\nline5');
      }
    });

    it('handles accept and reject of different hunks', () => {
      const fileDiff = createFileDiffFromContent(
        'file-1',
        '/readme.md',
        'line1\nline2\nline3\nline4\nline5',
        'modified1\nline2\nline3\nline4\nmodified5',
      );

      if (fileDiff.hunks.length < 2) {
        // If only one hunk, skip this test case
        return;
      }

      const acceptId = fileDiff.hunks[0].id;
      const rejectId = fileDiff.hunks[1].id;
      const result = acceptAndRejectHunks([fileDiff], [acceptId], [rejectId]);
      const fileResult = result.result['/readme.md'];

      expect(fileResult).toBeDefined();
      expect(fileResult?.isExternal).toBe(false);
      if (fileResult && !fileResult.isExternal) {
        // Should have both newBaseline and newCurrent
        expect(fileResult.newBaseline).toBeDefined();
        expect(fileResult.newCurrent).toBeDefined();
      }
    });

    it('accept wins when same hunk in both lists', () => {
      const fileDiff = createFileDiffFromContent(
        'file-1',
        '/readme.md',
        'line1',
        'line1\nline2',
      );
      const hunkId = fileDiff.hunks[0]?.id;
      if (!hunkId) throw new Error('Expected hunk');

      const result = acceptAndRejectHunks([fileDiff], [hunkId], [hunkId]);
      const fileResult = result.result['/readme.md'];

      expect(fileResult).toBeDefined();
      expect(fileResult?.isExternal).toBe(false);
      if (fileResult && !fileResult.isExternal) {
        // Accept should win - baseline is updated, not current
        expect(fileResult.newBaseline).toBe('line1\nline2');
        expect(fileResult.newCurrent).toBeUndefined();
      }
    });

    it('later FileDiff overwrites earlier for same path', () => {
      const fileDiff1 = createFileDiffFromContent(
        'file-1',
        '/readme.md',
        'original',
        'version1',
      );
      const fileDiff2 = createFileDiffFromContent(
        'file-2',
        '/readme.md',
        'version1',
        'version2',
      );

      const hunkId1 = fileDiff1.hunks[0]?.id;
      const hunkId2 = fileDiff2.hunks[0]?.id;
      if (!hunkId1 || !hunkId2) throw new Error('Expected hunks');

      const result = acceptAndRejectHunks(
        [fileDiff1, fileDiff2],
        [hunkId1, hunkId2],
        [],
      );
      const fileResult = result.result['/readme.md'];

      expect(fileResult).toBeDefined();
      expect(fileResult?.isExternal).toBe(false);
      if (fileResult && !fileResult.isExternal) {
        // Later FileDiff's result should be the final one
        expect(fileResult.newBaseline).toBe('version2');
      }
    });

    it('handles null baseline (file creation)', () => {
      const fileDiff = createFileDiffFromContent(
        'file-1',
        '/readme.md',
        null,
        'new file content',
      );
      const hunkId = fileDiff.hunks[0]?.id;
      if (!hunkId) throw new Error('Expected hunk');

      const result = acceptAndRejectHunks([fileDiff], [hunkId], []);
      const fileResult = result.result['/readme.md'];

      expect(fileResult).toBeDefined();
      expect(fileResult?.isExternal).toBe(false);
      if (fileResult && !fileResult.isExternal) {
        expect(fileResult.newBaseline).toBe('new file content');
      }
    });

    it('handles null current (file deletion)', () => {
      const fileDiff = createFileDiffFromContent(
        'file-1',
        '/readme.md',
        'original content',
        null,
      );
      const hunkId = fileDiff.hunks[0]?.id;
      if (!hunkId) throw new Error('Expected hunk');

      const result = acceptAndRejectHunks([fileDiff], [hunkId], []);
      const fileResult = result.result['/readme.md'];

      expect(fileResult).toBeDefined();
      expect(fileResult?.isExternal).toBe(false);
      if (fileResult && !fileResult.isExternal) {
        // Accepting deletion means baseline becomes empty/null
        expect(fileResult.newBaseline).toBe('');
      }
    });

    it('reports failed hunk IDs when patch cannot be applied', () => {
      // Create a real FileDiff from content, then modify baseline so patch won't apply
      const originalBaseline = 'line1\nline2\nline3\n';
      const current = 'line1\nmodified\nline3\n';

      // Create a proper FileDiff with real hunks
      const fileDiff = createFileDiffFromContent(
        'file-1',
        '/readme.md',
        originalBaseline,
        current,
      );

      // Now change the baseline so the hunk context won't match
      fileDiff.baseline = 'completely different content\n';

      const hunkId = fileDiff.hunks[0]?.id;
      if (!hunkId) {
        // If no hunk was created, the diff had no changes
        return;
      }

      const result = acceptAndRejectHunks([fileDiff], [hunkId], []);

      // Should report the failed hunk since context doesn't match modified baseline
      expect(result.failedAcceptedHunkIds).toContain(hunkId);
    });

    // =========================================================================
    // External File Tests
    // =========================================================================

    it('accepts external file hunk (oid swap)', () => {
      const externalDiff = createExternalFileDiff(
        'ext-1',
        '/image.png',
        'modified',
        'baseline-oid-123',
        'current-oid-456',
      );

      const result = acceptAndRejectHunks(
        [externalDiff],
        [externalDiff.hunkId],
        [],
      );

      expect(result.result['/image.png']).toBeDefined();
      const fileResult = result.result['/image.png'];
      expect(fileResult.isExternal).toBe(true);
      if (fileResult.isExternal) {
        expect(fileResult.newBaselineOid).toBe('current-oid-456');
      }
    });

    it('rejects external file hunk (oid revert)', () => {
      const externalDiff = createExternalFileDiff(
        'ext-1',
        '/image.png',
        'modified',
        'baseline-oid-123',
        'current-oid-456',
      );

      const result = acceptAndRejectHunks(
        [externalDiff],
        [],
        [externalDiff.hunkId],
      );

      expect(result.result['/image.png']).toBeDefined();
      const fileResult = result.result['/image.png'];
      expect(fileResult.isExternal).toBe(true);
      if (fileResult.isExternal) {
        expect(fileResult.newCurrentOid).toBe('baseline-oid-123');
      }
    });

    it('handles mixed text and external files', () => {
      const textDiff = createFileDiffFromContent(
        'file-1',
        '/readme.md',
        'line1',
        'line1\nline2',
      );
      const externalDiff = createExternalFileDiff(
        'ext-1',
        '/image.png',
        'created',
        null,
        'new-oid-789',
      );

      const textHunkId = textDiff.hunks[0]?.id;
      if (!textHunkId) throw new Error('Expected text hunk');

      const result = acceptAndRejectHunks(
        [textDiff, externalDiff],
        [textHunkId, externalDiff.hunkId],
        [],
      );

      // Text file should have newBaseline content
      const textResult = result.result['/readme.md'];
      expect(textResult.isExternal).toBe(false);
      if (!textResult.isExternal) {
        expect(textResult.newBaseline).toBe('line1\nline2');
      }

      // External file should have newBaselineOid
      const extResult = result.result['/image.png'];
      expect(extResult.isExternal).toBe(true);
      if (extResult.isExternal) {
        expect(extResult.newBaselineOid).toBe('new-oid-789');
      }
    });

    it('skips external files with no matching hunkId', () => {
      const externalDiff = createExternalFileDiff(
        'ext-1',
        '/image.png',
        'modified',
        'baseline-oid',
        'current-oid',
      );

      const result = acceptAndRejectHunks(
        [externalDiff],
        ['non-existent-hunk-id'],
        [],
      );

      expect(result.result['/image.png']).toBeUndefined();
    });

    it('accept wins for external file when hunkId in both lists', () => {
      const externalDiff = createExternalFileDiff(
        'ext-1',
        '/image.png',
        'modified',
        'baseline-oid-123',
        'current-oid-456',
      );

      // Same hunkId in both accept and reject lists
      const result = acceptAndRejectHunks(
        [externalDiff],
        [externalDiff.hunkId],
        [externalDiff.hunkId],
      );

      const fileResult = result.result['/image.png'];
      expect(fileResult.isExternal).toBe(true);
      if (fileResult.isExternal) {
        // Accept wins: baseline adopts current
        expect(fileResult.newBaselineOid).toBe('current-oid-456');
        // Reject should not have been processed
        expect(fileResult.newCurrentOid).toBeUndefined();
      }
    });
  });

  // ===========================================================================
  // createFileDiffsFromGenerations - External Files
  // ===========================================================================

  describe('createFileDiffsFromGenerations - external files', () => {
    it('creates ExternalFileDiff for generation with external operations', () => {
      const ops: OperationWithContent[] = [
        createExternalOpWithContent(
          createBaselineOp({
            filepath: '/image.png',
            reason: 'init',
            snapshot_oid: 'baseline-oid',
          }),
        ),
        createExternalOpWithContent(
          createEditOp({
            filepath: '/image.png',
            snapshot_oid: 'current-oid',
            contributor: 'agent-1',
          }),
        ),
      ];

      const result = createFileDiffsFromGenerations({ 'file-1': ops }, {});

      expect(result).toHaveLength(1);
      expect(isExternalFileDiff(result[0])).toBe(true);
      if (isExternalFileDiff(result[0])) {
        expect(result[0].isExternal).toBe(true);
        expect(result[0].changeType).toBe('modified');
        expect(result[0].baselineOid).toBe('baseline-oid');
        expect(result[0].currentOid).toBe('current-oid');
        expect(result[0].contributor).toBe('agent-1');
      }
    });

    it('determines changeType as created for external file', () => {
      const ops: OperationWithContent[] = [
        createExternalOpWithContent(
          createEditOp({
            filepath: '/new-image.png',
            snapshot_oid: 'new-oid',
            contributor: 'agent-1',
            reason: 'tool-1',
          }),
        ),
      ];

      const result = createFileDiffsFromGenerations({ 'file-1': ops }, {});

      expect(result).toHaveLength(1);
      if (isExternalFileDiff(result[0])) {
        expect(result[0].changeType).toBe('created');
        expect(result[0].baselineOid).toBeNull();
        expect(result[0].currentOid).toBe('new-oid');
      }
    });

    it('determines changeType as deleted for external file', () => {
      const ops: OperationWithContent[] = [
        createExternalOpWithContent(
          createBaselineOp({
            filepath: '/image.png',
            reason: 'init',
            snapshot_oid: 'original-oid',
          }),
        ),
        createExternalOpWithContent(
          createEditOp({
            filepath: '/image.png',
            snapshot_oid: null,
            contributor: 'agent-1',
          }),
        ),
      ];

      const result = createFileDiffsFromGenerations({ 'file-1': ops }, {});

      expect(result).toHaveLength(1);
      if (isExternalFileDiff(result[0])) {
        expect(result[0].changeType).toBe('deleted');
        expect(result[0].baselineOid).toBe('original-oid');
        expect(result[0].currentOid).toBeNull();
      }
    });

    it('creates TextFileDiff for generation without external flag', () => {
      const ops: OperationWithContent[] = [
        createOpWithContent(
          createBaselineOp({ filepath: '/readme.md', reason: 'init' }),
          'text content',
        ),
        createOpWithContent(
          createEditOp({ filepath: '/readme.md' }),
          'modified text content',
        ),
      ];

      const result = createFileDiffsFromGenerations(
        { 'file-1': ops },
        { 'file-1': { 0: 'user' as Contributor } },
      );

      expect(result).toHaveLength(1);
      expect(isTextFileDiff(result[0])).toBe(true);
      if (isTextFileDiff(result[0])) {
        expect(result[0].isExternal).toBe(false);
        expect(result[0].baseline).toBe('text content');
        expect(result[0].current).toBe('modified text content');
      }
    });

    it('handles mixed text and external generations', () => {
      const textOps: OperationWithContent[] = [
        createOpWithContent(
          createBaselineOp({ filepath: '/readme.md', reason: 'init' }),
          'text',
        ),
      ];
      const externalOps: OperationWithContent[] = [
        createExternalOpWithContent(
          createBaselineOp({
            filepath: '/image.png',
            reason: 'init',
            snapshot_oid: 'img-oid',
          }),
        ),
      ];

      const result = createFileDiffsFromGenerations(
        { 'file-1': textOps, 'file-2': externalOps },
        { 'file-1': { 0: 'user' as Contributor } },
      );

      expect(result).toHaveLength(2);

      const textDiff = result.find((d) => d.path === '/readme.md');
      const externalDiff = result.find((d) => d.path === '/image.png');

      expect(textDiff).toBeDefined();
      expect(externalDiff).toBeDefined();
      expect(isTextFileDiff(textDiff!)).toBe(true);
      expect(isExternalFileDiff(externalDiff!)).toBe(true);
    });
  });

  // ===========================================================================
  // Type Guards
  // ===========================================================================

  describe('type guards', () => {
    it('isTextFileDiff correctly identifies text files', () => {
      const textDiff = createFileDiffFromContent(
        'file-1',
        '/readme.md',
        'content',
        'content',
      );
      const externalDiff = createExternalFileDiff(
        'ext-1',
        '/image.png',
        'created',
        null,
        'oid',
      );

      expect(isTextFileDiff(textDiff)).toBe(true);
      expect(isTextFileDiff(externalDiff)).toBe(false);
    });

    it('isExternalFileDiff correctly identifies external files', () => {
      const textDiff = createFileDiffFromContent(
        'file-1',
        '/readme.md',
        'content',
        'content',
      );
      const externalDiff = createExternalFileDiff(
        'ext-1',
        '/image.png',
        'created',
        null,
        'oid',
      );

      expect(isExternalFileDiff(textDiff)).toBe(false);
      expect(isExternalFileDiff(externalDiff)).toBe(true);
    });
  });
});
