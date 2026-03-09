import { describe, it, expect } from 'vitest';
import type { WorkspaceSnapshot } from '@shared/karton-contracts/ui/agent/metadata';
import { computeWorkspaceChanges } from './workspace-changes';

function makeWs(
  ...mounts: Array<{ prefix: string; path: string }>
): WorkspaceSnapshot {
  return { mounts };
}

function summaries(
  entries: ReturnType<typeof computeWorkspaceChanges>,
): string[] {
  return entries.map((e) => e.summary);
}

describe('computeWorkspaceChanges', () => {
  it('returns empty array when previous is null', () => {
    const current = makeWs({ prefix: 'w1', path: '/home/user/project' });
    expect(computeWorkspaceChanges(null, current)).toEqual([]);
  });

  it('returns empty array when nothing changed', () => {
    const snap = makeWs({ prefix: 'w1', path: '/home/user/project' });
    expect(computeWorkspaceChanges(snap, snap)).toEqual([]);
  });

  it('returns empty array when both have no mounts', () => {
    const previous = makeWs();
    const current = makeWs();
    expect(computeWorkspaceChanges(previous, current)).toEqual([]);
  });

  it('detects single mount added', () => {
    const previous = makeWs();
    const current = makeWs({ prefix: 'w1', path: '/home/user/project' });
    const result = summaries(computeWorkspaceChanges(previous, current));
    expect(result).toEqual(['workspace mounted: w1 -> /home/user/project']);
  });

  it('detects single mount removed', () => {
    const previous = makeWs({ prefix: 'w1', path: '/home/user/project' });
    const current = makeWs();
    const result = summaries(computeWorkspaceChanges(previous, current));
    expect(result).toEqual([
      'workspace unmounted: w1 (was /home/user/project)',
    ]);
  });

  it('detects mount path changed', () => {
    const previous = makeWs({ prefix: 'w1', path: '/home/user/old' });
    const current = makeWs({ prefix: 'w1', path: '/home/user/new' });
    const result = summaries(computeWorkspaceChanges(previous, current));
    expect(result).toEqual([
      'workspace w1 changed: /home/user/old -> /home/user/new',
    ]);
  });

  it('detects multiple mounts with mixed changes', () => {
    const previous = makeWs(
      { prefix: 'w1', path: '/home/user/kept' },
      { prefix: 'w2', path: '/home/user/removed' },
      { prefix: 'w3', path: '/home/user/changed-old' },
    );
    const current = makeWs(
      { prefix: 'w1', path: '/home/user/kept' },
      { prefix: 'w3', path: '/home/user/changed-new' },
      { prefix: 'w4', path: '/home/user/added' },
    );
    const result = summaries(computeWorkspaceChanges(previous, current));
    expect(result).toEqual(
      expect.arrayContaining([
        'workspace w3 changed: /home/user/changed-old -> /home/user/changed-new',
        'workspace mounted: w4 -> /home/user/added',
        'workspace unmounted: w2 (was /home/user/removed)',
      ]),
    );
    expect(result).toHaveLength(3);
  });
});
