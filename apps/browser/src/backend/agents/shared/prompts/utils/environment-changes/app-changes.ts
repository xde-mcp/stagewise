import type { ActiveAppSnapshot } from '@shared/karton-contracts/ui/agent/metadata';
import type { EnvironmentChangeEntry } from './types';

function formatAppLabel(app: NonNullable<ActiveAppSnapshot>): string {
  return app.pluginId ? `${app.appId} (plugin: ${app.pluginId})` : app.appId;
}

/**
 * Compares two active-app snapshots and produces a change description
 * when the app was opened, closed, or switched.
 * Returns an empty array when nothing changed.
 */
export function computeAppChanges(
  prev: ActiveAppSnapshot,
  curr: ActiveAppSnapshot,
): EnvironmentChangeEntry[] {
  const same = prev?.appId === curr?.appId && prev?.pluginId === curr?.pluginId;
  if (same) return [];

  if (!prev && curr) {
    return [
      {
        type: 'app-opened',
        summary: `app opened: ${formatAppLabel(curr)}`,
      },
    ];
  }
  if (prev && !curr) {
    return [
      {
        type: 'app-closed',
        summary: `app closed: ${formatAppLabel(prev)}`,
      },
    ];
  }
  if (prev && curr) {
    return [
      {
        type: 'app-changed',
        summary: `app changed: ${formatAppLabel(prev)} -> ${formatAppLabel(curr)}`,
      },
    ];
  }

  return [];
}
