import { describe, it, expect } from 'vitest';
import { computeAppChanges } from './app-changes';

function _summaries(entries: ReturnType<typeof computeAppChanges>): string[] {
  return entries.map((e) => e.summary);
}

describe('computeAppChanges', () => {
  it('returns empty array when both are null', () => {
    expect(computeAppChanges(null, null)).toEqual([]);
  });

  it('returns empty array when app is unchanged', () => {
    const app = { appId: 'viewer', pluginId: 'figma-plugin' };
    expect(computeAppChanges(app, app)).toEqual([]);
  });

  it('returns empty array when app is unchanged (no pluginId)', () => {
    const app = { appId: 'my-app' };
    expect(computeAppChanges(app, app)).toEqual([]);
  });

  it('returns opened message with plugin when app opens', () => {
    const result = computeAppChanges(null, {
      appId: 'viewer',
      pluginId: 'figma-plugin',
    });
    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe('app opened: viewer (plugin: figma-plugin)');
    expect(result[0].type).toBe('app-opened');
  });

  it('returns opened message without plugin when self-built app opens', () => {
    const result = computeAppChanges(null, { appId: 'my-app' });
    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe('app opened: my-app');
  });

  it('returns closed message when app closes', () => {
    const result = computeAppChanges(
      { appId: 'viewer', pluginId: 'figma-plugin' },
      null,
    );
    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe('app closed: viewer (plugin: figma-plugin)');
    expect(result[0].type).toBe('app-closed');
  });

  it('returns closed message without plugin for self-built app', () => {
    const result = computeAppChanges({ appId: 'my-app' }, null);
    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe('app closed: my-app');
  });

  it('returns changed message when switching apps', () => {
    const result = computeAppChanges(
      { appId: 'old-app', pluginId: 'p1' },
      { appId: 'new-app', pluginId: 'p2' },
    );
    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe(
      'app changed: old-app (plugin: p1) -> new-app (plugin: p2)',
    );
    expect(result[0].type).toBe('app-changed');
  });

  it('returns changed message when switching from plugin app to self-built', () => {
    const result = computeAppChanges(
      { appId: 'viewer', pluginId: 'figma-plugin' },
      { appId: 'my-app' },
    );
    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe(
      'app changed: viewer (plugin: figma-plugin) -> my-app',
    );
  });
});
