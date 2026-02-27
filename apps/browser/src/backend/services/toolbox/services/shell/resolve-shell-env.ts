import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { DetectedShell } from './types';

const DEFAULT_RESOLVE_TIMEOUT_MS = 10_000;

export async function resolveShellEnv(
  shell: DetectedShell,
  timeoutMs = DEFAULT_RESOLVE_TIMEOUT_MS,
): Promise<Record<string, string> | null> {
  if (process.platform === 'win32') return null;

  const mark = randomUUID().replace(/-/g, '').slice(0, 12);
  const regex = new RegExp(`${mark}({.*})${mark}`);

  const command = `'${process.execPath}' -p '"${mark}" + JSON.stringify(process.env) + "${mark}"'`;

  let shellArgs: string[];
  switch (shell.type) {
    case 'bash':
    case 'zsh':
    case 'sh':
      shellArgs = ['-ilc', command];
      break;
    case 'powershell':
      return null;
    case 'cmd':
      return null;
  }

  const env: Record<string, string> = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    ELECTRON_NO_ATTACH_CONSOLE: '1',
    STAGEWISE_RESOLVING_ENVIRONMENT: '1',
  } as Record<string, string>;

  return new Promise<Record<string, string> | null>((resolve) => {
    const child = spawn(shell.path, shellArgs, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    const timeout = setTimeout(() => {
      child.kill();
      resolve(null);
    }, timeoutMs);

    const stdoutChunks: Buffer[] = [];
    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.on('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0 && code !== null) {
        resolve(null);
        return;
      }

      const raw = Buffer.concat(stdoutChunks).toString('utf-8');
      const match = regex.exec(raw);
      if (!match?.[1]) {
        resolve(null);
        return;
      }

      try {
        const parsed = JSON.parse(match[1]) as Record<string, string>;

        delete parsed.ELECTRON_RUN_AS_NODE;
        delete parsed.ELECTRON_NO_ATTACH_CONSOLE;
        delete parsed.STAGEWISE_RESOLVING_ENVIRONMENT;

        resolve(parsed);
      } catch {
        resolve(null);
      }
    });
  });
}
