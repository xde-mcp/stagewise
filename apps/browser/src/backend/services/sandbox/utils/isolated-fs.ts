import fs from 'node:fs';
import path from 'node:path';
import type { MountDescriptor } from '../ipc';

const MAX_DIFF_TEXT_FILE_SIZE = 2 * 1024 * 1024; // 2MB — matches shared-types

type DiffNotifier = (
  absolutePath: string,
  before: string | null,
  after: string | null,
  isExternal: boolean,
  bytesWritten: number,
) => void;

/**
 * Resolve a sandbox-relative path (e.g. "w1/src/index.ts") to an absolute
 * filesystem path, validating that it stays within the mount root.
 *
 * If only one mount is active, the prefix is optional for convenience.
 */
function resolveSandboxPath(
  sandboxPath: string | Buffer | URL,
  mounts: MountDescriptor[],
): string {
  const raw =
    typeof sandboxPath === 'string'
      ? sandboxPath
      : Buffer.isBuffer(sandboxPath)
        ? sandboxPath.toString()
        : sandboxPath instanceof URL && sandboxPath.protocol === 'file:'
          ? sandboxPath.pathname
          : String(sandboxPath);

  if (mounts.length === 0) {
    throw new Error('No workspaces mounted. Mount a workspace first.');
  }

  const parts = raw.split('/');
  const prefixCandidate = parts[0];
  const mount = mounts.find((m) => m.prefix === prefixCandidate);

  let mountRoot: string;
  let relativePart: string;

  if (mount) {
    mountRoot = mount.absolutePath;
    relativePart = parts.slice(1).join('/');
  } else if (mounts.length === 1) {
    mountRoot = mounts[0].absolutePath;
    relativePart = raw;
  } else {
    throw new Error(
      `Path must be prefixed with a mount (${mounts.map((m) => m.prefix).join(', ')}). Got: "${raw}"`,
    );
  }

  const safePart = path.resolve('/', relativePart);
  const absolute = path.join(mountRoot, safePart);

  if (!absolute.startsWith(mountRoot)) {
    throw new Error('Path escapes the mounted workspace.');
  }

  // Symlink protection: if the target already exists, verify the real path
  // stays within the mount. For new files (write/mkdir) this is skipped.
  try {
    const real = fs.realpathSync(absolute);
    if (!real.startsWith(mountRoot)) {
      throw new Error(
        'Resolved path (via symlink) escapes the mounted workspace.',
      );
    }
    return real;
  } catch (err: any) {
    if (err.code === 'ENOENT') return absolute;
    if (err.message?.includes('escapes')) throw err;
    return absolute;
  }
}

function isFileBinarySync(buf: Buffer): boolean {
  if (buf.length === 0) return false;
  const sample = buf.subarray(0, Math.min(buf.length, 8000));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true;
  }
  return false;
}

/**
 * Capture file content for diff tracking. Returns the text content (string)
 * for small text files, or null for binary/large/nonexistent files with
 * an `isExternal` flag.
 */
function captureState(absolutePath: string): {
  content: string | null;
  isExternal: boolean;
} {
  try {
    const stats = fs.statSync(absolutePath);
    if (stats.size > MAX_DIFF_TEXT_FILE_SIZE) {
      return { content: null, isExternal: true };
    }
    const buf = fs.readFileSync(absolutePath);
    if (isFileBinarySync(buf)) {
      return { content: null, isExternal: true };
    }
    return { content: buf.toString('utf-8'), isExternal: false };
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return { content: null, isExternal: false };
    }
    return { content: null, isExternal: true };
  }
}

// ---------------------------------------------------------------------------
// Function classification — determines which wrapper to apply and which
// argument positions contain paths. Based on sandboxed-fs, extended with
// modern Node.js methods.
// ---------------------------------------------------------------------------

const PATH_FUNCTIONS = [
  'access',
  'chmod',
  'chown',
  'lchmod',
  'lchown',
  'lstat',
  'mkdir',
  'open',
  'opendir',
  'readdir',
  'readlink',
  'rmdir',
  'rm',
  'stat',
  'statfs',
  'truncate',
  'unlink',
  'utimes',
  'lutimes',
  'exists',
] as const;

const FILE_FUNCTIONS = ['appendFile', 'readFile', 'writeFile'] as const;

const TWO_PATH_FUNCTIONS = [
  'copyFile',
  'cp',
  'link',
  'rename',
  'symlink',
] as const;

const PATH_NON_SYNC_FUNCTIONS = [
  'createReadStream',
  'createWriteStream',
  'watch',
  'watchFile',
  'unwatchFile',
] as const;

const STRING_PATH_FUNCTIONS = ['mkdtemp'] as const;

const REALPATH_FUNCTIONS = ['realpath'] as const;

/** Methods that mutate the filesystem and need diff tracking. */
const MUTATION_METHODS = new Set([
  'writeFile',
  'writeFileSync',
  'appendFile',
  'appendFileSync',
  'copyFile',
  'copyFileSync',
  'cp',
  'cpSync',
  'rename',
  'renameSync',
  'unlink',
  'unlinkSync',
  'rm',
  'rmSync',
  'rmdir',
  'rmdirSync',
  'mkdir',
  'mkdirSync',
  'link',
  'linkSync',
  'symlink',
  'symlinkSync',
  'truncate',
  'truncateSync',
  'chmod',
  'chmodSync',
  'chown',
  'chownSync',
  'lchmod',
  'lchmodSync',
  'lchown',
  'lchownSync',
  'utimes',
  'utimesSync',
  'lutimes',
  'lutimesSync',
]);

// ---------------------------------------------------------------------------
// Generic wrappers — one per argument signature pattern
// ---------------------------------------------------------------------------

type AnyFn = (...args: any[]) => any;

function wrapPathFn(
  fn: AnyFn,
  mounts: MountDescriptor[],
  notifyDiff: DiffNotifier | null,
  methodName: string,
): AnyFn {
  return (p: any, ...args: any[]) => {
    const resolved = resolveSandboxPath(p, mounts);
    if (notifyDiff && MUTATION_METHODS.has(methodName)) {
      const before = captureState(resolved);
      const result = fn(resolved, ...args);
      const after = captureState(resolved);
      const bytesWritten = after.content?.length ?? 0;
      notifyDiff(
        resolved,
        before.content,
        after.content,
        before.isExternal || after.isExternal,
        bytesWritten,
      );
      return result;
    }
    return fn(resolved, ...args);
  };
}

function wrapFileFn(
  fn: AnyFn,
  mounts: MountDescriptor[],
  notifyDiff: DiffNotifier | null,
  methodName: string,
): AnyFn {
  return (file: any, ...args: any[]) => {
    if (typeof file === 'number') return fn(file, ...args);
    const resolved = resolveSandboxPath(file, mounts);
    if (notifyDiff && MUTATION_METHODS.has(methodName)) {
      const before = captureState(resolved);
      const result = fn(resolved, ...args);
      const after = captureState(resolved);
      const bytesWritten = after.content?.length ?? 0;
      notifyDiff(
        resolved,
        before.content,
        after.content,
        before.isExternal || after.isExternal,
        bytesWritten,
      );
      return result;
    }
    return fn(resolved, ...args);
  };
}

function wrapTwoPathFn(
  fn: AnyFn,
  mounts: MountDescriptor[],
  notifyDiff: DiffNotifier | null,
  methodName: string,
): AnyFn {
  return (p1: any, p2: any, ...args: any[]) => {
    const r1 = resolveSandboxPath(p1, mounts);
    const r2 = resolveSandboxPath(p2, mounts);
    if (notifyDiff && MUTATION_METHODS.has(methodName)) {
      const beforeSrc = captureState(r1);
      const beforeDst = captureState(r2);
      const result = fn(r1, r2, ...args);
      const afterSrc = captureState(r1);
      const afterDst = captureState(r2);
      // Notify for source if changed (e.g. rename deletes source)
      if (beforeSrc.content !== afterSrc.content) {
        notifyDiff(
          r1,
          beforeSrc.content,
          afterSrc.content,
          beforeSrc.isExternal || afterSrc.isExternal,
          0,
        );
      }
      // Notify for destination
      notifyDiff(
        r2,
        beforeDst.content,
        afterDst.content,
        beforeDst.isExternal || afterDst.isExternal,
        afterDst.content?.length ?? 0,
      );
      return result;
    }
    return fn(r1, r2, ...args);
  };
}

function wrapStringPathFn(fn: AnyFn, mounts: MountDescriptor[]): AnyFn {
  return (prefix: any, ...args: any[]) => {
    const resolved = resolveSandboxPath(
      typeof prefix === 'string' ? prefix : String(prefix),
      mounts,
    );
    return fn(resolved, ...args);
  };
}

function wrapRealpathFn(fn: AnyFn, mounts: MountDescriptor[]): AnyFn {
  const wrapped: any = (p: any, ...args: any[]) => {
    const resolved = resolveSandboxPath(p, mounts);
    return fn(resolved, ...args);
  };
  if ((fn as any).native) {
    wrapped.native = (p: any, ...args: any[]) => {
      const resolved = resolveSandboxPath(p, mounts);
      return (fn as any).native(resolved, ...args);
    };
  }
  return wrapped;
}

// ---------------------------------------------------------------------------
// Async (promises) wrappers — same logic but for async functions, with
// async diff capture after awaiting the real call.
// ---------------------------------------------------------------------------

function wrapAsyncPathFn(
  fn: AnyFn,
  mounts: MountDescriptor[],
  notifyDiff: DiffNotifier | null,
  methodName: string,
): AnyFn {
  return async (p: any, ...args: any[]) => {
    const resolved = resolveSandboxPath(p, mounts);
    if (notifyDiff && MUTATION_METHODS.has(methodName)) {
      const before = captureState(resolved);
      const result = await fn(resolved, ...args);
      const after = captureState(resolved);
      notifyDiff(
        resolved,
        before.content,
        after.content,
        before.isExternal || after.isExternal,
        after.content?.length ?? 0,
      );
      return result;
    }
    return fn(resolved, ...args);
  };
}

function wrapAsyncFileFn(
  fn: AnyFn,
  mounts: MountDescriptor[],
  notifyDiff: DiffNotifier | null,
  methodName: string,
): AnyFn {
  return async (file: any, ...args: any[]) => {
    if (typeof file === 'number') return fn(file, ...args);
    const resolved = resolveSandboxPath(file, mounts);
    if (notifyDiff && MUTATION_METHODS.has(methodName)) {
      const before = captureState(resolved);
      const result = await fn(resolved, ...args);
      const after = captureState(resolved);
      notifyDiff(
        resolved,
        before.content,
        after.content,
        before.isExternal || after.isExternal,
        after.content?.length ?? 0,
      );
      return result;
    }
    return fn(resolved, ...args);
  };
}

function wrapAsyncTwoPathFn(
  fn: AnyFn,
  mounts: MountDescriptor[],
  notifyDiff: DiffNotifier | null,
  methodName: string,
): AnyFn {
  return async (p1: any, p2: any, ...args: any[]) => {
    const r1 = resolveSandboxPath(p1, mounts);
    const r2 = resolveSandboxPath(p2, mounts);
    if (notifyDiff && MUTATION_METHODS.has(methodName)) {
      const beforeSrc = captureState(r1);
      const beforeDst = captureState(r2);
      const result = await fn(r1, r2, ...args);
      const afterSrc = captureState(r1);
      const afterDst = captureState(r2);
      if (beforeSrc.content !== afterSrc.content) {
        notifyDiff(
          r1,
          beforeSrc.content,
          afterSrc.content,
          beforeSrc.isExternal || afterSrc.isExternal,
          0,
        );
      }
      notifyDiff(
        r2,
        beforeDst.content,
        afterDst.content,
        beforeDst.isExternal || afterDst.isExternal,
        afterDst.content?.length ?? 0,
      );
      return result;
    }
    return fn(r1, r2, ...args);
  };
}

function wrapAsyncStringPathFn(fn: AnyFn, mounts: MountDescriptor[]): AnyFn {
  return (prefix: any, ...args: any[]) => {
    const resolved = resolveSandboxPath(
      typeof prefix === 'string' ? prefix : String(prefix),
      mounts,
    );
    return fn(resolved, ...args);
  };
}

function wrapAsyncRealpathFn(fn: AnyFn, mounts: MountDescriptor[]): AnyFn {
  return (p: any, ...args: any[]) => {
    const resolved = resolveSandboxPath(p, mounts);
    return fn(resolved, ...args);
  };
}

// ---------------------------------------------------------------------------
// Main factory
// ---------------------------------------------------------------------------

/**
 * Create a restricted `fs` module scoped to the given mounts.
 *
 * @param mounts - Currently active mount descriptors for this agent
 * @param notifyDiff - Fire-and-forget callback to report file mutations
 *                     to the main process for diff-history tracking
 * @returns Objects mirroring `node:fs` and `node:fs/promises`
 */
export function createIsolatedFs(
  mounts: MountDescriptor[],
  notifyDiff: DiffNotifier | null,
): {
  isolatedFs: Record<string, any>;
  isolatedFsPromises: Record<string, any>;
} {
  const wrapped: Record<string, any> = Object.assign({}, fs);
  const wrappedPromises: Record<string, any> = Object.assign({}, fs.promises);

  // -- pathFunctions (single path as first arg) --
  for (const name of PATH_FUNCTIONS) {
    const fn = (fs as any)[name];
    if (fn) {
      wrapped[name] = wrapPathFn(fn, mounts, notifyDiff, name);
    }
    const syncName = `${name}Sync`;
    const syncFn = (fs as any)[syncName];
    if (syncFn) {
      wrapped[syncName] = wrapPathFn(syncFn, mounts, notifyDiff, syncName);
    }
    const promiseFn = (fs.promises as any)[name];
    if (promiseFn) {
      wrappedPromises[name] = wrapAsyncPathFn(
        promiseFn,
        mounts,
        notifyDiff,
        name,
      );
    }
  }

  // -- fileFunctions (path-or-fd first arg) --
  for (const name of FILE_FUNCTIONS) {
    const fn = (fs as any)[name];
    if (fn) {
      wrapped[name] = wrapFileFn(fn, mounts, notifyDiff, name);
    }
    const syncName = `${name}Sync`;
    const syncFn = (fs as any)[syncName];
    if (syncFn) {
      wrapped[syncName] = wrapFileFn(syncFn, mounts, notifyDiff, syncName);
    }
    const promiseFn = (fs.promises as any)[name];
    if (promiseFn) {
      wrappedPromises[name] = wrapAsyncFileFn(
        promiseFn,
        mounts,
        notifyDiff,
        name,
      );
    }
  }

  // -- twoPathFunctions (two path args) --
  for (const name of TWO_PATH_FUNCTIONS) {
    const fn = (fs as any)[name];
    if (fn) {
      wrapped[name] = wrapTwoPathFn(fn, mounts, notifyDiff, name);
    }
    const syncName = `${name}Sync`;
    const syncFn = (fs as any)[syncName];
    if (syncFn) {
      wrapped[syncName] = wrapTwoPathFn(syncFn, mounts, notifyDiff, syncName);
    }
    const promiseFn = (fs.promises as any)[name];
    if (promiseFn) {
      wrappedPromises[name] = wrapAsyncTwoPathFn(
        promiseFn,
        mounts,
        notifyDiff,
        name,
      );
    }
  }

  // -- pathNonSyncFunctions (no sync variant, no promises variant) --
  for (const name of PATH_NON_SYNC_FUNCTIONS) {
    const fn = (fs as any)[name];
    if (fn) {
      wrapped[name] = wrapPathFn(fn, mounts, null, name);
    }
  }

  // -- stringPathFunctions --
  for (const name of STRING_PATH_FUNCTIONS) {
    const fn = (fs as any)[name];
    if (fn) {
      wrapped[name] = wrapStringPathFn(fn, mounts);
    }
    const syncName = `${name}Sync`;
    const syncFn = (fs as any)[syncName];
    if (syncFn) {
      wrapped[syncName] = wrapStringPathFn(syncFn, mounts);
    }
    const promiseFn = (fs.promises as any)[name];
    if (promiseFn) {
      wrappedPromises[name] = wrapAsyncStringPathFn(promiseFn, mounts);
    }
  }

  // -- realpath (has .native) --
  for (const name of REALPATH_FUNCTIONS) {
    const fn = (fs as any)[name];
    if (fn) {
      wrapped[name] = wrapRealpathFn(fn, mounts);
    }
    const syncName = `${name}Sync`;
    const syncFn = (fs as any)[syncName];
    if (syncFn) {
      wrapped[syncName] = wrapRealpathFn(syncFn, mounts);
    }
    const promiseFn = (fs.promises as any)[name];
    if (promiseFn) {
      wrappedPromises[name] = wrapAsyncRealpathFn(promiseFn, mounts);
    }
  }

  // Ensure the promises sub-object is accessible on the main fs wrapper
  wrapped.promises = wrappedPromises;

  // Forward constants
  wrapped.constants = fs.constants;

  return { isolatedFs: wrapped, isolatedFsPromises: wrappedPromises };
}
