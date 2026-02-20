import type {
  EnvironmentDiffSnapshot,
  FileDiffSnapshot,
} from '@shared/karton-contracts/ui/shared-types';

function formatContributor(
  contributor: string,
  agentInstanceId: string,
): string {
  if (contributor === `agent-${agentInstanceId}`) return 'you';
  if (contributor === 'user') return 'user';
  return contributor;
}

function describeNewContributors(
  prevContributors: string[],
  currContributors: string[],
  agentInstanceId: string,
): string[] {
  const prevSet = new Set(prevContributors);
  const newOnes = currContributors.filter((c) => !prevSet.has(c));
  return newOnes.map((c) => formatContributor(c, agentInstanceId));
}

function buildSnapshotMap(
  snapshots: FileDiffSnapshot[],
): Map<string, FileDiffSnapshot> {
  const map = new Map<string, FileDiffSnapshot>();
  for (const s of snapshots) map.set(s.path, s);
  return map;
}

/**
 * Compares two environment diff snapshots and produces human-readable
 * change descriptions. Returns an empty array when there is no previous
 * snapshot (first message) or when nothing changed.
 *
 * @param previous - The snapshot from the previous user message (null for the first message)
 * @param current - The snapshot captured for the current user message
 * @param agentInstanceId - The ID of the agent receiving these changes (used to say "you" vs contributor name)
 */
export function computeEnvironmentDiffChanges(
  previous: EnvironmentDiffSnapshot | null,
  current: EnvironmentDiffSnapshot,
  agentInstanceId: string,
): string[] {
  if (!previous) return [];

  const changes: string[] = [];

  const prevPending = buildSnapshotMap(previous.pending);
  const currPending = buildSnapshotMap(current.pending);
  const currSummary = buildSnapshotMap(current.summary);

  // 1. Files that appeared in pending (new edits)
  for (const [path, curr] of currPending) {
    if (prevPending.has(path)) continue;

    const contributors = curr.contributors.map((c) =>
      formatContributor(c, agentInstanceId),
    );
    const who = contributors.join(', ');
    changes.push(`${who} modified ${path}`);
  }

  // 2. Files that disappeared from pending (all edits resolved)
  for (const [path] of prevPending) {
    if (currPending.has(path)) continue;

    const inSummary = currSummary.get(path);
    const summaryHasChanges =
      inSummary &&
      inSummary.hunkIds.length > 0 &&
      inSummary.baselineOid !== inSummary.currentOid;

    if (summaryHasChanges) {
      changes.push(`edits to ${path} were accepted`);
    } else {
      changes.push(`edits to ${path} were rejected`);
    }
  }

  // 3. Files still in pending but changed
  for (const [path, curr] of currPending) {
    const prev = prevPending.get(path);
    if (!prev) continue;

    const baselineChanged = prev.baselineOid !== curr.baselineOid;
    const currentChanged = prev.currentOid !== curr.currentOid;
    const hunksReduced = curr.hunkIds.length < prev.hunkIds.length;
    const hunksIncreased = curr.hunkIds.length > prev.hunkIds.length;

    if (baselineChanged && hunksReduced) {
      changes.push(
        `some edits to ${path} were accepted (${curr.hunkIds.length} hunk${curr.hunkIds.length !== 1 ? 's' : ''} remaining)`,
      );
    }

    if (currentChanged && !baselineChanged && hunksReduced) {
      changes.push(`some edits to ${path} were rejected`);
    }

    const newContributors = describeNewContributors(
      prev.contributors,
      curr.contributors,
      agentInstanceId,
    );
    if (currentChanged && newContributors.length > 0) {
      const who = newContributors.join(', ');
      changes.push(`${who} modified ${path}`);
    }

    if (currentChanged && hunksIncreased && newContributors.length === 0) {
      changes.push(`${path} has new pending edits`);
    }
  }

  // 4. Summary-only changes: files that disappeared from summary entirely
  const prevSummary = buildSnapshotMap(previous.summary);
  for (const [path] of prevSummary) {
    if (currSummary.has(path)) continue;
    if (!prevPending.has(path) && !currPending.has(path)) {
      changes.push(`all changes to ${path} were undone`);
    }
  }

  return changes;
}
