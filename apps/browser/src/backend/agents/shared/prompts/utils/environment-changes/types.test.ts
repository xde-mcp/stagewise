import { describe, it, expect } from 'vitest';
import {
  renderEnvironmentChangesXml,
  type EnvironmentChangeEntry,
} from './types';

describe('renderEnvironmentChangesXml', () => {
  it('returns empty string for empty array', () => {
    expect(renderEnvironmentChangesXml([])).toBe('');
  });

  it('renders simple entry with type and summary', () => {
    const entries: EnvironmentChangeEntry[] = [
      { type: 'tab-closed', summary: 'tab closed: [t_1]' },
    ];
    const xml = renderEnvironmentChangesXml(entries);
    expect(xml).toContain('<env-changes>');
    expect(xml).toContain('</env-changes>');
    expect(xml).toContain('<entry type="tab-closed">tab closed: [t_1]</entry>');
  });

  it('renders entry with attributes and escapes special chars', () => {
    const entries: EnvironmentChangeEntry[] = [
      {
        type: 'agents-md-created',
        summary: 'AGENTS.md created in w1',
        attributes: { path: 'w1', label: 'a&b "c"' },
      },
    ];
    const xml = renderEnvironmentChangesXml(entries);
    expect(xml).toContain(' path="w1"');
    expect(xml).toContain(' label="a&amp;b &quot;c&quot;"');
  });

  it('renders entry with detail appended after summary', () => {
    const entries: EnvironmentChangeEntry[] = [
      {
        type: 'agents-md-updated',
        summary: 'AGENTS.md updated in w1',
        detail: '--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new',
        attributes: { path: 'w1' },
      },
    ];
    const xml = renderEnvironmentChangesXml(entries);
    expect(xml).toContain('AGENTS.md updated in w1\n--- a');
    expect(xml).toContain('+new</entry>');
  });

  it('renders multiple entries', () => {
    const entries: EnvironmentChangeEntry[] = [
      { type: 'sandbox-restarted', summary: 'sandbox restarted' },
      { type: 'tab-opened', summary: 'new tab opened: [t_2]' },
      {
        type: 'skill-enabled',
        summary: 'skill enabled: foo',
        attributes: { path: 'foo' },
      },
    ];
    const xml = renderEnvironmentChangesXml(entries);
    expect(xml.match(/<entry /g)).toHaveLength(3);
    expect(xml.match(/<\/entry>/g)).toHaveLength(3);
    expect(xml).toMatch(/^<env-changes>\n.*\n<\/env-changes>$/s);
  });

  it('wraps body in CDATA when it contains < or &', () => {
    const entries: EnvironmentChangeEntry[] = [
      {
        type: 'agents-md-updated',
        summary: 'AGENTS.md updated',
        detail: 'use <b>bold</b> & italic',
      },
    ];
    const xml = renderEnvironmentChangesXml(entries);
    expect(xml).toContain(
      '<![CDATA[AGENTS.md updated\nuse <b>bold</b> & italic]]>',
    );
  });

  it('does not wrap body in CDATA when no special chars', () => {
    const entries: EnvironmentChangeEntry[] = [
      { type: 'tab-closed', summary: 'tab closed' },
    ];
    const xml = renderEnvironmentChangesXml(entries);
    expect(xml).not.toContain('CDATA');
    expect(xml).toContain('>tab closed</entry>');
  });

  it('escapes ]]> within CDATA body', () => {
    const entries: EnvironmentChangeEntry[] = [
      {
        type: 'test',
        summary: 'has ]]> in <content>',
      },
    ];
    const xml = renderEnvironmentChangesXml(entries);
    // The literal ]]> in body content gets split into ]]]]><![CDATA[>
    expect(xml).toContain(']]]]><![CDATA[>');
  });
});
