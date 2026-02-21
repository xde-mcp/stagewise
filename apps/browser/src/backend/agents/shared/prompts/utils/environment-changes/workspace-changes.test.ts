import { describe, it, expect } from 'vitest';
import type { WorkspaceSnapshot } from '@shared/karton-contracts/ui/agent/metadata';
import { computeWorkspaceChanges } from './workspace-changes';

function makeWs(
  isConnected: boolean,
  workspacePath: string | null = null,
): WorkspaceSnapshot {
  return { isConnected, workspacePath };
}

describe('computeWorkspaceChanges', () => {
  it('returns empty array when previous is null', () => {
    const current = makeWs(true, '/home/user/project');
    expect(computeWorkspaceChanges(null, current)).toEqual([]);
  });

  it('returns empty array when nothing changed', () => {
    const snap = makeWs(true, '/home/user/project');
    expect(computeWorkspaceChanges(snap, snap)).toEqual([]);
  });

  it('detects workspace disconnection', () => {
    const previous = makeWs(true, '/home/user/project');
    const current = makeWs(false, null);
    const result = computeWorkspaceChanges(previous, current);
    expect(result).toEqual(['workspace disconnected']);
  });

  it('detects workspace connection', () => {
    const previous = makeWs(false);
    const current = makeWs(true, '/home/user/project');
    const result = computeWorkspaceChanges(previous, current);
    expect(result).toEqual(['workspace connected: /home/user/project']);
  });

  it('detects workspace path change', () => {
    const previous = makeWs(true, '/home/user/old-project');
    const current = makeWs(true, '/home/user/new-project');
    const result = computeWorkspaceChanges(previous, current);
    expect(result).toEqual([
      'workspace: /home/user/old-project -> /home/user/new-project',
    ]);
  });

  it('returns empty when both disconnected', () => {
    const previous = makeWs(false);
    const current = makeWs(false);
    expect(computeWorkspaceChanges(previous, current)).toEqual([]);
  });
});
