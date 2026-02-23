import type {
  EnvironmentDiffSnapshot,
  FileDiffSnapshot,
} from '@shared/karton-contracts/ui/shared-types';

type FileChange = {
  modifiers: string[];
  editsGone: boolean;
  editsPartiallyRemoved: boolean;
};

function formatContributor(
  contributor: string,
  agentInstanceId: string,
): string {
  if (contributor === `agent-${agentInstanceId}`) return 'you';
  if (contributor === 'user') return 'user';
  return contributor;
}

function buildSnapshotMap(
  snapshots: FileDiffSnapshot[],
): Map<string, FileDiffSnapshot> {
  const map = new Map<string, FileDiffSnapshot>();
  for (const s of snapshots) map.set(s.path, s);
  return map;
}

function getOrCreate(map: Map<string, FileChange>, path: string): FileChange {
  let entry = map.get(path);
  if (!entry) {
    entry = { modifiers: [], editsGone: false, editsPartiallyRemoved: false };
    map.set(path, entry);
  }
  return entry;
}

function newContributorsExcludingSelf(
  prevContributors: string[],
  currContributors: string[],
  selfKey: string,
): string[] {
  const prevSet = new Set(prevContributors);
  return currContributors.filter((c) => !prevSet.has(c) && c !== selfKey);
}

function formatFileChange(
  path: string,
  change: FileChange,
  agentInstanceId: string,
): string | null {
  const hasModifiers = change.modifiers.length > 0;
  const formatted = change.modifiers.map((c) =>
    formatContributor(c, agentInstanceId),
  );

  if (hasModifiers && change.editsGone)
    return `${path} modified by: [${formatted.join(', ')}] (your edits no longer present)`;
  if (hasModifiers && change.editsPartiallyRemoved)
    return `${path} modified by: [${formatted.join(', ')}] (some of your edits were removed)`;
  if (hasModifiers) return `${path} modified by: [${formatted.join(', ')}]`;
  if (change.editsGone) return `${path}: your edits no longer present`;
  if (change.editsPartiallyRemoved)
    return `${path}: some of your edits were removed`;
  return null;
}

/**
 * Compares two environment diff snapshots and produces compact,
 * per-file change descriptions. Only reports modifications by others
 * and status changes to the agent's own pending edits.
 *
 * Never reports:
 * - "modified by you" (agent already knows about its own edits)
 * - "new pending edits" / "edits undone" (irrelevant to the agent)
 *
 * Distinguishes accept from reject by comparing the summary's
 * currentOid: if the summary still reflects the pending content,
 * the edits were accepted (not reported); otherwise they were
 * reverted (reported as "your edits no longer present").
 */
export function computeFileDiffChanges(
  previous: EnvironmentDiffSnapshot | null,
  current: EnvironmentDiffSnapshot,
  agentInstanceId: string,
): string[] {
  if (!previous) return [];

  const selfKey = `agent-${agentInstanceId}`;
  const prevPending = buildSnapshotMap(previous.pending);
  const currPending = buildSnapshotMap(current.pending);
  const prevSummary = buildSnapshotMap(previous.summary);
  const currSummary = buildSnapshotMap(current.summary);

  const fileChanges = new Map<string, FileChange>();

  // 1. Files that appeared in pending (new edits by others)
  for (const [path, curr] of currPending) {
    if (prevPending.has(path)) continue;
    const entry = getOrCreate(fileChanges, path);
    const prevSummaryEntry = prevSummary.get(path);
    if (prevSummaryEntry) {
      entry.modifiers.push(
        ...newContributorsExcludingSelf(
          prevSummaryEntry.contributors,
          curr.contributors,
          selfKey,
        ),
      );
    } else {
      const others = curr.contributors.filter(
        (c) => c !== selfKey && c !== 'user',
      );
      if (others.length > 0) {
        entry.modifiers.push(...others);
      } else if (
        !curr.contributors.includes(selfKey) &&
        curr.contributors.includes('user')
      ) {
        entry.modifiers.push('user');
      }
    }
  }

  // 2. Files that disappeared from pending (edits resolved)
  for (const [path, prev] of prevPending) {
    if (currPending.has(path)) continue;
    const selfWasContributor = prev.contributors.includes(selfKey);

    // Check if the pending content survived by comparing OIDs:
    // if the summary's current state still matches what was pending,
    // the edits were accepted into the baseline — not reverted.
    const summarySnap = currSummary.get(path);
    const editsStillReflectedInSummary =
      summarySnap != null && summarySnap.currentOid === prev.currentOid;

    if (selfWasContributor && !editsStillReflectedInSummary) {
      const entry = getOrCreate(fileChanges, path);
      entry.editsGone = true;
    }
  }

  // 3. Files still in pending but changed
  for (const [path, curr] of currPending) {
    const prev = prevPending.get(path);
    if (!prev) continue;

    const currentChanged = prev.currentOid !== curr.currentOid;
    if (!currentChanged) continue;

    const entry = getOrCreate(fileChanges, path);
    const baselineChanged = prev.baselineOid !== curr.baselineOid;
    const hunksReduced = curr.hunkIds.length < prev.hunkIds.length;

    const newModifiers = newContributorsExcludingSelf(
      prev.contributors,
      curr.contributors,
      selfKey,
    );
    entry.modifiers.push(...newModifiers);

    const selfWasPrev = prev.contributors.includes(selfKey);
    const selfInCurr = curr.contributors.includes(selfKey);
    if (selfWasPrev && !selfInCurr) {
      // Agent removed from pending contributors — check if the
      // agent's edits were accepted (reflected in summary) rather
      // than reverted. Use the same OID comparison as section 2,
      // but against the current pending's currentOid since the
      // file is still in pending with other contributors' changes.
      const summarySnap = currSummary.get(path);
      const editsStillReflected =
        summarySnap != null && summarySnap.currentOid === curr.currentOid;
      if (!editsStillReflected) entry.editsGone = true;
    } else if (!baselineChanged && hunksReduced && selfWasPrev) {
      entry.editsPartiallyRemoved = true;
    }
  }

  const changes: string[] = [];
  for (const [path, change] of fileChanges) {
    const line = formatFileChange(path, change, agentInstanceId);
    if (line) changes.push(line);
  }

  return changes;
}
