import type { EnabledSkillsSnapshot } from '@shared/karton-contracts/ui/agent/metadata';
import type { EnvironmentChangeEntry } from './types';

/**
 * Compares two enabled-skills snapshots and produces structured
 * change entries. Detects skills enabled or disabled.
 */
export function computeSkillsChanges(
  previous: EnabledSkillsSnapshot | null,
  current: EnabledSkillsSnapshot,
): EnvironmentChangeEntry[] {
  if (!previous) return [];

  const prevSet = new Set(previous.paths);
  const currSet = new Set(current.paths);

  const changes: EnvironmentChangeEntry[] = [];

  for (const p of currSet) {
    if (!prevSet.has(p)) {
      changes.push({
        type: 'skill-enabled',
        summary: `skill enabled: ${p}`,
        attributes: { path: p },
      });
    }
  }
  for (const p of prevSet) {
    if (!currSet.has(p)) {
      changes.push({
        type: 'skill-disabled',
        summary: `skill disabled: ${p}`,
        attributes: { path: p },
      });
    }
  }

  return changes;
}
