import { describe, it, expect } from 'vitest';
import { getShellArgs } from './detect-shell';
import type { DetectedShell } from './types';

describe('getShellArgs', () => {
  it('returns -c for bash', () => {
    const shell: DetectedShell = { type: 'bash', path: '/bin/bash' };
    expect(getShellArgs(shell, 'echo hi')).toEqual([
      '/bin/bash',
      ['-c', 'echo hi'],
    ]);
  });

  it('returns -c for zsh', () => {
    const shell: DetectedShell = { type: 'zsh', path: '/bin/zsh' };
    expect(getShellArgs(shell, 'echo hi')).toEqual([
      '/bin/zsh',
      ['-c', 'echo hi'],
    ]);
  });

  it('returns -c for sh', () => {
    const shell: DetectedShell = { type: 'sh', path: '/bin/sh' };
    expect(getShellArgs(shell, 'echo hi')).toEqual([
      '/bin/sh',
      ['-c', 'echo hi'],
    ]);
  });

  it('returns -NoProfile -Command for powershell', () => {
    const shell: DetectedShell = {
      type: 'powershell',
      path: 'C:\\Windows\\System32\\pwsh.exe',
    };
    expect(getShellArgs(shell, 'Get-Process')).toEqual([
      'C:\\Windows\\System32\\pwsh.exe',
      ['-NoProfile', '-Command', 'Get-Process'],
    ]);
  });

  it('returns /c for cmd', () => {
    const shell: DetectedShell = {
      type: 'cmd',
      path: 'C:\\Windows\\System32\\cmd.exe',
    };
    expect(getShellArgs(shell, 'dir')).toEqual([
      'C:\\Windows\\System32\\cmd.exe',
      ['/c', 'dir'],
    ]);
  });

  it('preserves special characters as a single command arg', () => {
    const shell: DetectedShell = { type: 'bash', path: '/bin/bash' };
    const cmd = 'echo "hello world" | grep hello';
    const [, args] = getShellArgs(shell, cmd);
    expect(args).toEqual(['-c', cmd]);
    expect(args[1]).toBe(cmd);
  });
});
