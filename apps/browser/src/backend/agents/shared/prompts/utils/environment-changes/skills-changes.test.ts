import { describe, it, expect } from 'vitest';
import type { EnabledSkillsSnapshot } from '@shared/karton-contracts/ui/agent/metadata';
import { computeSkillsChanges } from './skills-changes';

function makeSnap(paths: string[]): EnabledSkillsSnapshot {
  return { paths };
}

describe('computeSkillsChanges', () => {
  it('returns empty array when previous is null', () => {
    expect(
      computeSkillsChanges(null, makeSnap(['w1/.stagewise/skills/foo'])),
    ).toEqual([]);
  });

  it('returns empty array when nothing changed', () => {
    const snap = makeSnap(['w1/.stagewise/skills/foo', 'plugins/bar/SKILL.md']);
    expect(computeSkillsChanges(snap, snap)).toEqual([]);
  });

  it('detects skill enabled', () => {
    const prev = makeSnap([]);
    const curr = makeSnap(['w1/.stagewise/skills/foo']);
    const result = computeSkillsChanges(prev, curr);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('skill-enabled');
    expect(result[0].summary).toContain('w1/.stagewise/skills/foo');
    expect(result[0].attributes?.path).toBe('w1/.stagewise/skills/foo');
  });

  it('detects skill disabled', () => {
    const prev = makeSnap(['plugins/bar/SKILL.md']);
    const curr = makeSnap([]);
    const result = computeSkillsChanges(prev, curr);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('skill-disabled');
    expect(result[0].summary).toContain('plugins/bar/SKILL.md');
    expect(result[0].attributes?.path).toBe('plugins/bar/SKILL.md');
  });

  it('detects multiple skills changed at once', () => {
    const prev = makeSnap([
      'w1/.stagewise/skills/kept',
      'w1/.agents/skills/removed',
    ]);
    const curr = makeSnap([
      'w1/.stagewise/skills/kept',
      'plugins/new-plugin/SKILL.md',
    ]);
    const result = computeSkillsChanges(prev, curr);
    expect(result).toHaveLength(2);
    const types = result.map((r) => r.type);
    expect(types).toContain('skill-enabled');
    expect(types).toContain('skill-disabled');
    expect(
      result.find((r) => r.type === 'skill-enabled')?.attributes?.path,
    ).toBe('plugins/new-plugin/SKILL.md');
    expect(
      result.find((r) => r.type === 'skill-disabled')?.attributes?.path,
    ).toBe('w1/.agents/skills/removed');
  });
});
