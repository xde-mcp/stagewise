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

function toRelativePath(
  absolutePath: string,
  workspacePath: string | null,
): string {
  if (workspacePath && absolutePath.startsWith(workspacePath)) {
    return absolutePath.slice(workspacePath.length).replace(/^\//, '');
  }
  return absolutePath;
}

function formatFileChange(
  path: string,
  change: FileChange,
  agentInstanceId: string,
  workspacePath: string | null,
): string | null {
  const rel = toRelativePath(path, workspacePath);
  const hasModifiers = change.modifiers.length > 0;
  const formatted = change.modifiers.map((c) =>
    formatContributor(c, agentInstanceId),
  );

  if (hasModifiers && change.editsGone)
    return `${rel} modified by: [${formatted.join(', ')}] (your edits no longer present)`;
  if (hasModifiers && change.editsPartiallyRemoved)
    return `${rel} modified by: [${formatted.join(', ')}] (some of your edits were removed)`;
  if (hasModifiers) return `${rel} modified by: [${formatted.join(', ')}]`;
  if (change.editsGone) return `${rel}: your edits no longer present`;
  if (change.editsPartiallyRemoved)
    return `${rel}: some of your edits were removed`;
  return null;
}

/**
 * Compares two environment diff snapshots and produces compact,
 * per-file change descriptions. Only reports modifications by others
 * and status changes to the agent's own pending edits.
 *
 * Never reports:
 * - "modified by you" (agent already knows about its own edits)
 * - "edits accepted/rejected" (replaced by "your edits no longer present")
 * - "new pending edits" / "edits undone" (irrelevant to the agent)
 */
export function computeFileDiffChanges(
  previous: EnvironmentDiffSnapshot | null,
  current: EnvironmentDiffSnapshot,
  agentInstanceId: string,
  workspacePath: string | null = null,
): string[] {
  if (!previous) return [];

  const selfKey = `agent-${agentInstanceId}`;
  const prevPending = buildSnapshotMap(previous.pending);
  const currPending = buildSnapshotMap(current.pending);
  const prevSummary = buildSnapshotMap(previous.summary);

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
    if (selfWasContributor) {
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
      entry.editsGone = true;
    } else if (!baselineChanged && hunksReduced && selfWasPrev) {
      entry.editsPartiallyRemoved = true;
    }
  }

  const changes: string[] = [];
  for (const [path, change] of fileChanges) {
    const line = formatFileChange(path, change, agentInstanceId, workspacePath);
    if (line) changes.push(line);
  }

  return changes;
}
