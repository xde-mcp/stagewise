import type { WorkspaceSnapshot } from '@shared/karton-contracts/ui/agent/metadata';
import type { EnvironmentChangeEntry } from './types';

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
): EnvironmentChangeEntry[] {
  if (!previous) return [];

  const changes: EnvironmentChangeEntry[] = [];

  const prevMap = new Map(previous.mounts.map((m) => [m.prefix, m]));
  const currMap = new Map(current.mounts.map((m) => [m.prefix, m]));

  for (const [prefix, mount] of currMap) {
    const prev = prevMap.get(prefix);
    if (!prev) {
      changes.push({
        type: 'workspace-mounted',
        summary: `workspace mounted: ${prefix} -> ${mount.path}${formatPermissions(mount.permissions)}`,
        attributes: { prefix },
      });
    } else if (prev.path !== mount.path) {
      changes.push({
        type: 'workspace-path-changed',
        summary: `workspace ${prefix} changed: ${prev.path} -> ${mount.path}${formatPermissions(mount.permissions)}`,
        attributes: { prefix },
      });
    } else {
      const prevPerms = (prev.permissions ?? []).join(',');
      const currPerms = (mount.permissions ?? []).join(',');
      if (prevPerms !== currPerms) {
        changes.push({
          type: 'workspace-permissions-changed',
          summary: `workspace ${prefix} permissions changed: [${prevPerms}] -> [${currPerms}]`,
          attributes: { prefix },
        });
      }
    }
  }

  for (const [prefix, mount] of prevMap) {
    if (!currMap.has(prefix)) {
      changes.push({
        type: 'workspace-unmounted',
        summary: `workspace unmounted: ${prefix} (was ${mount.path})`,
        attributes: { prefix },
      });
    }
  }

  return changes;
}
