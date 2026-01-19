import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { ClientRuntime } from '@stagewise/agent-runtime-interface';
import { capToolOutput } from '@stagewise/agent-tools';
import { resolve } from 'node:path';

const AGENTS_MD_FILENAME = 'AGENTS.md';

export async function readAgentsMd(
  clientRuntime: ClientRuntime,
): Promise<string | null> {
  const path = clientRuntime.fileSystem.getCurrentWorkingDirectory();
  const agentsMdPath = resolve(path, AGENTS_MD_FILENAME);
  const exists = existsSync(agentsMdPath);
  if (!exists) return null;
  try {
    const content = await readFile(agentsMdPath, 'utf-8');
    const output = capToolOutput(content).result;
    return output;
  } catch (_e) {
    return null;
  }
}
