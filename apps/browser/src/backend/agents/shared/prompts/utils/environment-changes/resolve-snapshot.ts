import type { AgentMessage } from '@shared/karton-contracts/ui/agent';
import type {
  EnvironmentSnapshot,
  FullEnvironmentSnapshot,
  BrowserSnapshot,
  WorkspaceSnapshot,
} from '@shared/karton-contracts/ui/agent/metadata';
import type { EnvironmentDiffSnapshot } from '@shared/karton-contracts/ui/shared-types';

/**
 * Walks backward through message history to reconstruct the full
 * effective environment snapshot at `upToIndex` by collecting the
 * most recent defined value for each domain.
 *
 * Returns `null` when no complete snapshot can be assembled (e.g.
 * no messages carry any snapshot data).
 */
export function resolveEffectiveSnapshot(
  messages: AgentMessage[],
  upToIndex: number,
): FullEnvironmentSnapshot | null {
  let browser: BrowserSnapshot | undefined;
  let workspace: WorkspaceSnapshot | undefined;
  let fileDiffs: EnvironmentDiffSnapshot | undefined;
  let sandboxSessionId: string | null | undefined;

  for (let i = upToIndex; i >= 0; i--) {
    const snap = messages[i]?.metadata?.environmentSnapshot;
    if (!snap) continue;
    if (browser === undefined && snap.browser !== undefined)
      browser = snap.browser;
    if (workspace === undefined && snap.workspace !== undefined)
      workspace = snap.workspace;
    if (fileDiffs === undefined && snap.fileDiffs !== undefined)
      fileDiffs = snap.fileDiffs;
    if (sandboxSessionId === undefined && snap.sandboxSessionId !== undefined)
      sandboxSessionId = snap.sandboxSessionId;
    if (
      browser !== undefined &&
      workspace !== undefined &&
      fileDiffs !== undefined &&
      sandboxSessionId !== undefined
    )
      break;
  }

  if (
    browser === undefined ||
    workspace === undefined ||
    fileDiffs === undefined ||
    sandboxSessionId === undefined
  )
    return null;

  return { browser, workspace, fileDiffs, sandboxSessionId };
}

/**
 * Compares a full live snapshot against a previously resolved effective
 * snapshot and returns a sparse snapshot containing only the domains
 * that differ.
 *
 * When `previous` is `null` (first message / keyframe), the full
 * snapshot is returned as-is so every domain is present.
 */
export function sparsifySnapshot(
  full: FullEnvironmentSnapshot,
  previous: FullEnvironmentSnapshot | null,
): EnvironmentSnapshot {
  if (!previous) return { ...full };

  const sparse: EnvironmentSnapshot = {};

  if (JSON.stringify(full.browser) !== JSON.stringify(previous.browser))
    sparse.browser = full.browser;
  if (JSON.stringify(full.workspace) !== JSON.stringify(previous.workspace))
    sparse.workspace = full.workspace;
  if (JSON.stringify(full.fileDiffs) !== JSON.stringify(previous.fileDiffs))
    sparse.fileDiffs = full.fileDiffs;
  if (full.sandboxSessionId !== previous.sandboxSessionId)
    sparse.sandboxSessionId = full.sandboxSessionId;

  return sparse;
}
