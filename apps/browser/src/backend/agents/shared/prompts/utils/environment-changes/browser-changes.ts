import type { BrowserSnapshot } from '@shared/karton-contracts/ui/agent/metadata';

/**
 * Compares two browser snapshots and produces compact, grouped
 * change descriptions. Returns an empty array when there is no
 * previous snapshot (first message) or when nothing changed.
 */
export function computeBrowserChanges(
  previous: BrowserSnapshot | null,
  current: BrowserSnapshot,
): string[] {
  if (!previous) return [];

  const prevTabs = new Map(previous.tabs.map((t) => [t.handle, t]));
  const currTabs = new Map(current.tabs.map((t) => [t.handle, t]));

  const closed: string[] = [];
  const opened: string[] = [];
  const navigated: string[] = [];

  for (const [handle] of prevTabs)
    if (!currTabs.has(handle)) closed.push(handle);

  for (const [handle, curr] of currTabs) {
    if (!prevTabs.has(handle)) {
      opened.push(`${handle} (${curr.url})`);
      continue;
    }
    const prev = prevTabs.get(handle)!;
    if (prev.url !== curr.url)
      navigated.push(`${handle} (${prev.url} -> ${curr.url})`);
  }

  const changes: string[] = [];

  if (closed.length > 0) {
    const label = closed.length === 1 ? 'tab closed' : 'tabs closed';
    changes.push(`${label}: [${closed.join(', ')}]`);
  }
  if (opened.length > 0) {
    const label = opened.length === 1 ? 'new tab opened' : 'new tabs opened';
    changes.push(`${label}: [${opened.join(', ')}]`);
  }
  if (navigated.length > 0) {
    const label = navigated.length === 1 ? 'tab navigated' : 'tabs navigated';
    changes.push(`${label}: [${navigated.join(', ')}]`);
  }

  if (
    previous.activeTabHandle !== current.activeTabHandle &&
    current.activeTabHandle !== null
  ) {
    if (previous.activeTabHandle === null)
      changes.push(`active tab: ${current.activeTabHandle}`);
    else
      changes.push(
        `active tab: ${previous.activeTabHandle} -> ${current.activeTabHandle}`,
      );
  }

  return changes;
}
