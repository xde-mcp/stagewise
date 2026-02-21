import type { WorkspaceSnapshot } from '@shared/karton-contracts/ui/agent/metadata';

/**
 * Compares two workspace snapshots and produces human-readable
 * change descriptions. Returns an empty array when there is no
 * previous snapshot (first message) or when nothing changed.
 */
export function computeWorkspaceChanges(
  previous: WorkspaceSnapshot | null,
  current: WorkspaceSnapshot,
): string[] {
  if (!previous) return [];

  const changes: string[] = [];

  const wasConnected = previous.isConnected;
  const isConnected = current.isConnected;

  if (wasConnected && !isConnected) {
    changes.push('workspace disconnected');
    return changes;
  }

  if (!wasConnected && isConnected) {
    changes.push(`workspace connected: ${current.workspacePath}`);
    return changes;
  }

  if (
    wasConnected &&
    isConnected &&
    previous.workspacePath !== current.workspacePath
  ) {
    changes.push(
      `workspace: ${previous.workspacePath} -> ${current.workspacePath}`,
    );
  }

  return changes;
}
