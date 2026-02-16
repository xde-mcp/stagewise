import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import type { ClientRuntimeNode } from '@stagewise/agent-runtime-node';
import { resolve } from 'node:path';

export interface Skill {
  name: string;
  description: string;
  path: string;
}

function parseFrontmatter(content: string): {
  name?: string;
  description?: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

async function discoverSkills(skillsDir: string): Promise<Skill[]> {
  if (!existsSync(skillsDir)) return [];

  const entries = await readdir(skillsDir, { withFileTypes: true });
  const skills: Skill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = resolve(skillsDir, entry.name);
    const skillMdPath = resolve(skillPath, 'SKILL.md');
    if (!existsSync(skillMdPath)) continue;

    const content = await readFile(skillMdPath, 'utf-8');
    const meta = parseFrontmatter(content);
    if (!meta.name || !meta.description) continue;

    skills.push({
      name: meta.name,
      description: meta.description,
      path: skillPath,
    });
  }

  return skills;
}

export async function getSkills(
  clientRuntime: ClientRuntimeNode,
): Promise<Skill[]> {
  const cwd = clientRuntime.fileSystem.getCurrentWorkingDirectory();
  const stagewiseSkillsPath = resolve(cwd, '.stagewise', 'skills');
  const globalSkillsPath = resolve(cwd, '.agents', 'skills');

  const [stagewiseSkills, globalSkills] = await Promise.all([
    discoverSkills(stagewiseSkillsPath),
    discoverSkills(globalSkillsPath),
  ]);

  stagewiseSkills.sort((a, b) => a.name.localeCompare(b.name));
  globalSkills.sort((a, b) => a.name.localeCompare(b.name));

  const seen = new Set<string>();
  const result: Skill[] = [];

  for (const skill of [...stagewiseSkills, ...globalSkills]) {
    if (seen.has(skill.name)) continue;
    seen.add(skill.name);
    result.push(skill);
  }

  return result;
}
