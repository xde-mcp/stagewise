import { describe, it, expect } from 'vitest';
import type {
  EnvironmentDiffSnapshot,
  FileDiffSnapshot,
} from '@shared/karton-contracts/ui/shared-types';
import { computeEnvironmentDiffChanges } from './environment-changes';

function makeSnapshot(
  overrides: Partial<FileDiffSnapshot> & { path: string },
): FileDiffSnapshot {
  return {
    fileId: overrides.fileId ?? `fid-${overrides.path}`,
    isExternal: overrides.isExternal ?? false,
    baselineOid: overrides.baselineOid ?? 'base-oid',
    currentOid: overrides.currentOid ?? 'curr-oid',
    hunkIds: overrides.hunkIds ?? ['hunk-1'],
    contributors: overrides.contributors ?? ['agent-1'],
    ...overrides,
  };
}

function makeEnv(
  pending: FileDiffSnapshot[],
  summary: FileDiffSnapshot[],
): EnvironmentDiffSnapshot {
  return { pending, summary };
}

const AGENT_ID = '1';

describe('computeEnvironmentDiffChanges', () => {
  it('returns empty array when previous is null', () => {
    const current = makeEnv(
      [makeSnapshot({ path: '/file.txt' })],
      [makeSnapshot({ path: '/file.txt' })],
    );
    const result = computeEnvironmentDiffChanges(null, current, AGENT_ID);
    expect(result).toEqual([]);
  });

  it('detects file appearing in pending (agent edit)', () => {
    const previous = makeEnv([], []);
    const current = makeEnv(
      [
        makeSnapshot({
          path: '/file.txt',
          contributors: ['agent-1'],
        }),
      ],
      [makeSnapshot({ path: '/file.txt' })],
    );
    const result = computeEnvironmentDiffChanges(previous, current, AGENT_ID);
    expect(result).toContain('you modified /file.txt');
  });

  it('detects file appearing in pending (other agent)', () => {
    const previous = makeEnv([], []);
    const current = makeEnv(
      [
        makeSnapshot({
          path: '/file.txt',
          contributors: ['agent-99'],
        }),
      ],
      [],
    );
    const result = computeEnvironmentDiffChanges(previous, current, AGENT_ID);
    expect(result).toContain('agent-99 modified /file.txt');
  });

  it('detects file disappearing from pending (accepted)', () => {
    const previous = makeEnv(
      [makeSnapshot({ path: '/file.txt' })],
      [makeSnapshot({ path: '/file.txt' })],
    );
    const current = makeEnv(
      [],
      [
        makeSnapshot({
          path: '/file.txt',
          baselineOid: 'new-base',
          currentOid: 'new-curr',
          hunkIds: ['h1'],
        }),
      ],
    );
    const result = computeEnvironmentDiffChanges(previous, current, AGENT_ID);
    expect(result).toContain('edits to /file.txt were accepted');
  });

  it('detects file disappearing from pending (rejected)', () => {
    const previous = makeEnv(
      [makeSnapshot({ path: '/file.txt' })],
      [makeSnapshot({ path: '/file.txt' })],
    );
    const current = makeEnv([], []);
    const result = computeEnvironmentDiffChanges(previous, current, AGENT_ID);
    expect(result).toContain('edits to /file.txt were rejected');
  });

  it('detects partial accept (baseline changed, hunks reduced)', () => {
    const previous = makeEnv(
      [
        makeSnapshot({
          path: '/file.txt',
          baselineOid: 'old-base',
          currentOid: 'curr',
          hunkIds: ['h1', 'h2', 'h3'],
        }),
      ],
      [],
    );
    const current = makeEnv(
      [
        makeSnapshot({
          path: '/file.txt',
          baselineOid: 'new-base',
          currentOid: 'curr',
          hunkIds: ['h3'],
        }),
      ],
      [],
    );
    const result = computeEnvironmentDiffChanges(previous, current, AGENT_ID);
    expect(result).toContain(
      'some edits to /file.txt were accepted (1 hunk remaining)',
    );
  });

  it('detects partial reject (current changed, hunks reduced)', () => {
    const previous = makeEnv(
      [
        makeSnapshot({
          path: '/file.txt',
          baselineOid: 'base',
          currentOid: 'old-curr',
          hunkIds: ['h1', 'h2'],
        }),
      ],
      [],
    );
    const current = makeEnv(
      [
        makeSnapshot({
          path: '/file.txt',
          baselineOid: 'base',
          currentOid: 'new-curr',
          hunkIds: ['h2'],
        }),
      ],
      [],
    );
    const result = computeEnvironmentDiffChanges(previous, current, AGENT_ID);
    expect(result).toContain('some edits to /file.txt were rejected');
  });

  it('detects user modification (new user contributor)', () => {
    const previous = makeEnv(
      [
        makeSnapshot({
          path: '/file.txt',
          currentOid: 'old-curr',
          contributors: ['agent-1'],
        }),
      ],
      [],
    );
    const current = makeEnv(
      [
        makeSnapshot({
          path: '/file.txt',
          currentOid: 'new-curr',
          contributors: ['agent-1', 'user'],
        }),
      ],
      [],
    );
    const result = computeEnvironmentDiffChanges(previous, current, AGENT_ID);
    expect(result).toContain('user modified /file.txt');
  });

  it('detects another agent modifying a file', () => {
    const previous = makeEnv(
      [
        makeSnapshot({
          path: '/file.txt',
          currentOid: 'old-curr',
          contributors: ['agent-1'],
        }),
      ],
      [],
    );
    const current = makeEnv(
      [
        makeSnapshot({
          path: '/file.txt',
          currentOid: 'new-curr',
          contributors: ['agent-1', 'agent-42'],
        }),
      ],
      [],
    );
    const result = computeEnvironmentDiffChanges(previous, current, AGENT_ID);
    expect(result).toContain('agent-42 modified /file.txt');
  });

  it('detects file disappearing from summary (undo)', () => {
    const previous = makeEnv([], [makeSnapshot({ path: '/undone.txt' })]);
    const current = makeEnv([], []);
    const result = computeEnvironmentDiffChanges(previous, current, AGENT_ID);
    expect(result).toContain('all changes to /undone.txt were undone');
  });

  it('returns empty array when nothing changed', () => {
    const snapshot = makeEnv(
      [makeSnapshot({ path: '/file.txt' })],
      [makeSnapshot({ path: '/file.txt' })],
    );
    const result = computeEnvironmentDiffChanges(snapshot, snapshot, AGENT_ID);
    expect(result).toEqual([]);
  });
});
