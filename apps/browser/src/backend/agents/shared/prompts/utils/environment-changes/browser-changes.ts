import type { BrowserSnapshot } from '@shared/karton-contracts/ui/agent/metadata';
import type { EnvironmentChangeEntry } from './types';

/**
 * Compares two browser snapshots and produces compact, grouped
 * change descriptions. Returns an empty array when there is no
 * previous snapshot (first message) or when nothing changed.
 */
export function computeBrowserChanges(
  previous: BrowserSnapshot | null,
  current: BrowserSnapshot,
): EnvironmentChangeEntry[] {
  if (!previous) return [];

  const prevTabs = new Map(previous.tabs.map((t) => [t.handle, t]));
  const currTabs = new Map(current.tabs.map((t) => [t.handle, t]));

  const closed: string[] = [];
  const opened: string[] = [];
  const navigated: string[] = [];
  const titleChanged: string[] = [];
  const errorChanges: string[] = [];
  const consoleChanges: string[] = [];

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
    if (prev.title !== curr.title)
      titleChanged.push(`${handle} ("${prev.title}" -> "${curr.title}")`);

    const prevErr = prev.error;
    const currErr = curr.error;
    if (JSON.stringify(prevErr) !== JSON.stringify(currErr)) {
      if (!prevErr && currErr)
        errorChanges.push(
          `${handle}: error ${currErr.code}${currErr.message ? ` - ${currErr.message}` : ''}`,
        );
      else if (prevErr && !currErr)
        errorChanges.push(`${handle}: error cleared`);
      else if (prevErr && currErr)
        errorChanges.push(
          `${handle}: error changed ${prevErr.code} -> ${currErr.code}`,
        );
    }

    const prevLogs = prev.consoleLogCount ?? 0;
    const currLogs = curr.consoleLogCount ?? 0;
    const prevErrors = prev.consoleErrorCount ?? 0;
    const currErrors = curr.consoleErrorCount ?? 0;
    if (currLogs > prevLogs || currErrors > prevErrors) {
      const parts: string[] = [];
      if (currLogs > prevLogs) parts.push(`+${currLogs - prevLogs} log(s)`);
      if (currErrors > prevErrors)
        parts.push(`+${currErrors - prevErrors} error(s)`);
      consoleChanges.push(`${handle}: ${parts.join(', ')}`);
    }
  }

  const changes: EnvironmentChangeEntry[] = [];

  if (closed.length > 0) {
    const label = closed.length === 1 ? 'tab closed' : 'tabs closed';
    changes.push({
      type: 'tab-closed',
      summary: `${label}: [${closed.join(', ')}]`,
    });
  }
  if (opened.length > 0) {
    const label = opened.length === 1 ? 'new tab opened' : 'new tabs opened';
    changes.push({
      type: 'tab-opened',
      summary: `${label}: [${opened.join(', ')}]`,
    });
  }
  if (navigated.length > 0) {
    const label = navigated.length === 1 ? 'tab navigated' : 'tabs navigated';
    changes.push({
      type: 'tab-navigated',
      summary: `${label}: [${navigated.join(', ')}]`,
    });
  }
  if (titleChanged.length > 0) {
    changes.push({
      type: 'tab-title-changed',
      summary: `tab title changed: [${titleChanged.join(', ')}]`,
    });
  }
  if (errorChanges.length > 0) {
    changes.push({
      type: 'tab-error',
      summary: `tab errors: [${errorChanges.join(', ')}]`,
    });
  }
  if (consoleChanges.length > 0) {
    changes.push({
      type: 'tab-console',
      summary: `console output: [${consoleChanges.join(', ')}]`,
    });
  }

  if (
    previous.activeTabHandle !== current.activeTabHandle &&
    current.activeTabHandle !== null
  ) {
    const summary =
      previous.activeTabHandle === null
        ? `active tab: ${current.activeTabHandle}`
        : `active tab: ${previous.activeTabHandle} -> ${current.activeTabHandle}`;
    changes.push({ type: 'active-tab-changed', summary });
  }

  return changes;
}
