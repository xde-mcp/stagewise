import type { EnvironmentSnapshot } from '@shared/karton-contracts/ui/agent/metadata';
import { computeBrowserChanges } from './browser-changes';
import { computeFileDiffChanges } from './file-diff-changes';
import { computeWorkspaceChanges } from './workspace-changes';

export { computeBrowserChanges } from './browser-changes';
export { computeFileDiffChanges } from './file-diff-changes';
export { computeWorkspaceChanges } from './workspace-changes';

/**
 * Compares two full environment snapshots and returns all
 * human-readable change descriptions across browser tabs,
 * workspace state, and file diffs.
 *
 * Returns an empty array when `previous` is null (first message)
 * or when nothing changed.
 */
export function computeAllEnvironmentChanges(
  previous: EnvironmentSnapshot | null,
  current: EnvironmentSnapshot,
  agentInstanceId: string,
): string[] {
  if (!previous) return [];

  return [
    ...computeBrowserChanges(previous.browser, current.browser),
    ...computeWorkspaceChanges(previous.workspace, current.workspace),
    ...computeFileDiffChanges(
      previous.fileDiffs,
      current.fileDiffs,
      agentInstanceId,
      current.workspace.workspacePath,
    ),
  ];
}
