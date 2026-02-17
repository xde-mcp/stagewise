import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

export const WORKSPACE_MD_FILENAME = 'WORKSPACE.md';
export const WORKSPACE_MD_DIR = '.stagewise';

export async function readWorkspaceMd(
  workspacePath: string,
): Promise<string | null> {
  try {
    const workspaceMdPath = resolve(
      workspacePath,
      WORKSPACE_MD_DIR,
      WORKSPACE_MD_FILENAME,
    );
    if (!existsSync(workspaceMdPath)) return null;
    const content = await readFile(workspaceMdPath, 'utf-8');
    return content;
  } catch (_e) {
    return null;
  }
}
