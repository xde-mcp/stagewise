import type { FullEnvironmentSnapshot } from '@shared/karton-contracts/ui/agent/metadata';
import { computeBrowserChanges } from './browser-changes';
import { computeFileDiffChanges } from './file-diff-changes';
import { computeSandboxChanges } from './sandbox-changes';
import { computeWorkspaceChanges } from './workspace-changes';

export { computeBrowserChanges } from './browser-changes';
export { computeFileDiffChanges } from './file-diff-changes';
export { computeSandboxChanges } from './sandbox-changes';
export { computeWorkspaceChanges } from './workspace-changes';
export {
  resolveEffectiveSnapshot,
  sparsifySnapshot,
} from './resolve-snapshot';

/**
 * Compares two fully-resolved environment snapshots and returns all
 * human-readable change descriptions across browser tabs,
 * workspace state, and file diffs.
 *
 * Returns an empty array when `previous` is null (first message)
 * or when nothing changed.
 */
export function computeAllEnvironmentChanges(
  previous: FullEnvironmentSnapshot | null,
  current: FullEnvironmentSnapshot,
  agentInstanceId: string,
): string[] {
  if (!previous) return [];

  return [
    ...computeSandboxChanges(
      previous.sandboxSessionId,
      current.sandboxSessionId,
    ),
    ...computeBrowserChanges(previous.browser, current.browser),
    ...computeWorkspaceChanges(previous.workspace, current.workspace),
    ...computeFileDiffChanges(
      previous.fileDiffs,
      current.fileDiffs,
      agentInstanceId,
    ),
  ];
}
