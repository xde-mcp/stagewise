import type { WorkspaceSnapshot } from '@shared/karton-contracts/ui/agent/metadata';

/**
 * Compares two workspace snapshots and produces human-readable
 * change descriptions. Detects mounts added, removed, or changed.
 * Returns an empty array when there is no previous snapshot
 * (first message) or when nothing changed.
 */
export function computeWorkspaceChanges(
  previous: WorkspaceSnapshot | null,
  current: WorkspaceSnapshot,
): string[] {
  if (!previous) return [];

  const changes: string[] = [];

  const prevMap = new Map(previous.mounts.map((m) => [m.prefix, m.path]));
  const currMap = new Map(current.mounts.map((m) => [m.prefix, m.path]));

  for (const [prefix, path] of currMap) {
    if (!prevMap.has(prefix))
      changes.push(`workspace mounted: ${prefix} -> ${path}`);
    else if (prevMap.get(prefix) !== path)
      changes.push(
        `workspace ${prefix} changed: ${prevMap.get(prefix)} -> ${path}`,
      );
  }

  for (const [prefix, path] of prevMap)
    if (!currMap.has(prefix))
      changes.push(`workspace unmounted: ${prefix} (was ${path})`);

  return changes;
}
