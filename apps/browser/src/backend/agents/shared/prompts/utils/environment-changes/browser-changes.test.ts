import { describe, it, expect } from 'vitest';
import type { BrowserSnapshot } from '@shared/karton-contracts/ui/agent/metadata';
import { computeBrowserChanges } from './browser-changes';

function makeBrowser(
  tabs: { handle: string; url: string; title: string }[],
  activeTabHandle: string | null = null,
): BrowserSnapshot {
  return { tabs, activeTabHandle };
}

describe('computeBrowserChanges', () => {
  it('returns empty array when previous is null', () => {
    const current = makeBrowser(
      [{ handle: 't_1', url: 'https://a.com', title: 'A' }],
      't_1',
    );
    expect(computeBrowserChanges(null, current)).toEqual([]);
  });

  it('returns empty array when nothing changed', () => {
    const snap = makeBrowser(
      [{ handle: 't_1', url: 'https://a.com', title: 'A' }],
      't_1',
    );
    expect(computeBrowserChanges(snap, snap)).toEqual([]);
  });

  it('detects a closed tab (singular)', () => {
    const previous = makeBrowser([
      { handle: 't_1', url: 'https://a.com', title: 'Tab A' },
      { handle: 't_2', url: 'https://b.com', title: 'Tab B' },
    ]);
    const current = makeBrowser([
      { handle: 't_1', url: 'https://a.com', title: 'Tab A' },
    ]);
    const result = computeBrowserChanges(previous, current);
    expect(result).toContain('tab closed: [t_2]');
  });

  it('detects multiple closed tabs (plural)', () => {
    const previous = makeBrowser([
      { handle: 't_1', url: 'https://a.com', title: 'A' },
      { handle: 't_2', url: 'https://b.com', title: 'B' },
      { handle: 't_3', url: 'https://c.com', title: 'C' },
    ]);
    const current = makeBrowser([
      { handle: 't_1', url: 'https://a.com', title: 'A' },
    ]);
    const result = computeBrowserChanges(previous, current);
    expect(result).toContain('tabs closed: [t_2, t_3]');
  });

  it('detects a new tab (singular)', () => {
    const previous = makeBrowser([
      { handle: 't_1', url: 'https://a.com', title: 'A' },
    ]);
    const current = makeBrowser([
      { handle: 't_1', url: 'https://a.com', title: 'A' },
      { handle: 't_2', url: 'https://b.com', title: 'B' },
    ]);
    const result = computeBrowserChanges(previous, current);
    expect(result).toContain('new tab opened: [t_2 (https://b.com)]');
  });

  it('detects tab navigation', () => {
    const previous = makeBrowser([
      { handle: 't_1', url: 'https://a.com', title: 'A' },
    ]);
    const current = makeBrowser([
      { handle: 't_1', url: 'https://b.com', title: 'B' },
    ]);
    const result = computeBrowserChanges(previous, current);
    expect(result).toContain(
      'tab navigated: [t_1 (https://a.com -> https://b.com)]',
    );
  });

  it('detects active tab change', () => {
    const previous = makeBrowser(
      [
        { handle: 't_1', url: 'https://a.com', title: 'A' },
        { handle: 't_2', url: 'https://b.com', title: 'B' },
      ],
      't_1',
    );
    const current = makeBrowser(
      [
        { handle: 't_1', url: 'https://a.com', title: 'A' },
        { handle: 't_2', url: 'https://b.com', title: 'B' },
      ],
      't_2',
    );
    const result = computeBrowserChanges(previous, current);
    expect(result).toContain('active tab: t_1 -> t_2');
  });

  it('detects active tab set from null', () => {
    const previous = makeBrowser(
      [{ handle: 't_1', url: 'https://a.com', title: 'A' }],
      null,
    );
    const current = makeBrowser(
      [{ handle: 't_1', url: 'https://a.com', title: 'A' }],
      't_1',
    );
    const result = computeBrowserChanges(previous, current);
    expect(result).toContain('active tab: t_1');
  });

  it('does not report active tab change when it becomes null', () => {
    const previous = makeBrowser(
      [{ handle: 't_1', url: 'https://a.com', title: 'A' }],
      't_1',
    );
    const current = makeBrowser([], null);
    const result = computeBrowserChanges(previous, current);
    expect(result).toContain('tab closed: [t_1]');
    expect(result.some((c) => c.startsWith('active tab'))).toBe(false);
  });

  it('handles multiple simultaneous changes', () => {
    const previous = makeBrowser(
      [
        { handle: 't_1', url: 'https://a.com', title: 'A' },
        { handle: 't_2', url: 'https://b.com', title: 'B' },
      ],
      't_1',
    );
    const current = makeBrowser(
      [
        {
          handle: 't_2',
          url: 'https://b2.com',
          title: 'B2',
        },
        { handle: 't_3', url: 'https://c.com', title: 'C' },
      ],
      't_3',
    );
    const result = computeBrowserChanges(previous, current);
    expect(result).toContain('tab closed: [t_1]');
    expect(result).toContain('new tab opened: [t_3 (https://c.com)]');
    expect(result).toContain(
      'tab navigated: [t_2 (https://b.com -> https://b2.com)]',
    );
    expect(result).toContain('active tab: t_1 -> t_3');
  });
});
