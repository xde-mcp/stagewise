import type { WorkspaceSnapshot } from '@shared/karton-contracts/ui/agent/metadata';

function formatPermissions(permissions?: string[]): string {
  if (!permissions || permissions.length === 0) return '';
  return ` [${permissions.join(', ')}]`;
}

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

  const prevMap = new Map(previous.mounts.map((m) => [m.prefix, m]));
  const currMap = new Map(current.mounts.map((m) => [m.prefix, m]));

  for (const [prefix, mount] of currMap) {
    const prev = prevMap.get(prefix);
    if (!prev) {
      changes.push(
        `workspace mounted: ${prefix} -> ${mount.path}${formatPermissions(mount.permissions)}`,
      );
    } else if (prev.path !== mount.path) {
      changes.push(
        `workspace ${prefix} changed: ${prev.path} -> ${mount.path}${formatPermissions(mount.permissions)}`,
      );
    } else {
      const prevPerms = (prev.permissions ?? []).join(',');
      const currPerms = (mount.permissions ?? []).join(',');
      if (prevPerms !== currPerms) {
        changes.push(
          `workspace ${prefix} permissions changed: [${prevPerms}] -> [${currPerms}]`,
        );
      }
    }
  }

  for (const [prefix, mount] of prevMap)
    if (!currMap.has(prefix))
      changes.push(`workspace unmounted: ${prefix} (was ${mount.path})`);

  return changes;
}
