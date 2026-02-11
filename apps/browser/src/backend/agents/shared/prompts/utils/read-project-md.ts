import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

export const PROJECT_MD_FILENAME = 'PROJECT.md';
export const PROJECT_MD_DIR = '.stagewise';

export async function readProjectMd(
  workspacePath: string,
): Promise<string | null> {
  try {
    const projectMdPath = resolve(
      workspacePath,
      PROJECT_MD_DIR,
      PROJECT_MD_FILENAME,
    );
    if (!existsSync(projectMdPath)) return null;
    const content = await readFile(projectMdPath, 'utf-8');
    return content;
  } catch (_e) {
    return null;
  }
}
