import vm from 'node:vm';
import { createWorkerIPC } from './ipc';

const contexts = new Map<string, vm.Context>();
/** Per-agent cache of fetched ESM modules for dynamic import() resolution. */
const moduleCaches = new Map<string, Map<string, vm.Module>>();
const pendingCdp = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
>();
const pendingFileOps = new Map<
  string,
  {
    resolve: (value: { success: true; bytesWritten: number }) => void;
    reject: (reason: unknown) => void;
  }
>();
const pendingAttachmentOps = new Map<
  string,
  {
    resolve: (value: {
      id: string;
      fileName: string;
      mediaType: string;
      content: Buffer;
    }) => void;
    reject: (reason: unknown) => void;
  }
>();
const ipc = createWorkerIPC();

/** Node.js built-in modules safe to expose (computational, no I/O). */
const ALLOWED_NODE_MODULES = new Set([
  'buffer',
  'crypto',
  'events',
  'path',
  'querystring',
  'stream',
  'string_decoder',
  'url',
  'util',
  'zlib',
  'assert',
]);

/** Node.js built-in modules that must be blocked for sandbox security. */
const BLOCKED_NODE_MODULES = new Set([
  'fs',
  'fs/promises',
  'net',
  'http',
  'https',
  'http2',
  'child_process',
  'cluster',
  'dgram',
  'tls',
  'dns',
  'worker_threads',
  'vm',
  'process',
  'os',
  'v8',
  'inspector',
  'readline',
  'repl',
  'tty',
]);

let cdpReqId = 0;
let fileReqId = 0;
let attachmentReqId = 0;

function getSandboxAPI(agentId: string) {
  return {
    sendCDP(tabId: string, method: string, params?: any) {
      const id = `${cdpReqId++}`;
      return new Promise((resolve, reject) => {
        pendingCdp.set(id, { resolve, reject });
        ipc.send({ type: 'cdp', id, tabId, method, params });
      });
    },
    writeFile(
      relativePath: string,
      content: Buffer | string,
    ): Promise<{ success: true; bytesWritten: number }> {
      const id = `${fileReqId++}`;
      const isBase64 = Buffer.isBuffer(content);
      const contentStr = isBase64 ? content.toString('base64') : content;

      return new Promise((resolve, reject) => {
        pendingFileOps.set(id, { resolve, reject });
        ipc.send({
          type: 'write-file',
          id,
          agentId,
          relativePath,
          content: contentStr,
          isBase64,
        });
      });
    },
    getAttachment(attachmentId: string): Promise<{
      id: string;
      fileName: string;
      mediaType: string;
      content: Buffer;
    }> {
      const id = `${attachmentReqId++}`;
      return new Promise((resolve, reject) => {
        pendingAttachmentOps.set(id, { resolve, reject });
        ipc.send({
          type: 'get-attachment',
          id,
          agentId,
          attachmentId,
        });
      });
    },
  };
}

/**
 * Node.js globals that are NOT provided by vm.createContext() by default.
 * V8 built-ins (JSON, Promise, Map, Set, Array, Object, Math, RegExp,
 * Date, Error, typed arrays, etc.) are already available automatically.
 */
function getContextGlobals() {
  const globals: Record<string, unknown> = {
    // Timers
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    setImmediate: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
      setTimeout(fn, 0, ...args),
    clearImmediate: clearTimeout,
    // Networking
    fetch,
    Headers,
    Request,
    Response,
    AbortController,
    AbortSignal,
    // Console (useful for debugging, output goes to worker's stdout)
    console,
    // Web APIs exposed by Node.js
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Blob,
    FormData,
    // Binary data
    Buffer,
    // Utilities
    structuredClone,
    atob,
    btoa,
    queueMicrotask,
    crypto: {
      randomUUID: () => crypto.randomUUID(),
    },
    // Compatibility shims for CDN packages that expect browser/Node globals
    process: {
      env: { NODE_ENV: 'production' },
      browser: true,
      version: '',
      nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
        queueMicrotask(() => fn(...args)),
    },
  };

  // self and global are circular references back to globalThis.
  // They must be set after context creation via vm.createContext(),
  // so we return them as part of the globals object and the context
  // itself becomes their value once assigned.
  globals.self = globals;
  globals.global = globals;

  return globals;
}

/**
 * Resolve a `node:` built-in module and wrap it as a vm.SyntheticModule
 * so it can be returned from the `importModuleDynamically` callback.
 *
 * Allowed modules are imported from the host process (the utility worker
 * has full Node.js available) and their exports are re-exposed into the
 * sandboxed VM context. Blocked modules throw a clear error.
 */
async function resolveNodeModule(
  specifier: string,
  ctx: vm.Context,
  cache: Map<string, vm.Module>,
): Promise<vm.Module> {
  const cached = cache.get(specifier);
  if (cached) return cached;

  const name = specifier.replace(/^node:/, '');

  if (BLOCKED_NODE_MODULES.has(name))
    throw new Error(
      `"${specifier}" is not available in the sandbox for security reasons.`,
    );

  if (!ALLOWED_NODE_MODULES.has(name))
    throw new Error(
      `"${specifier}" is not a recognised allowed Node.js module. ` +
        `Allowed: ${[...ALLOWED_NODE_MODULES].map((m) => `node:${m}`).join(', ')}`,
    );

  const hostModule = await import(specifier);
  const exportNames = Object.keys(hostModule);

  const synth = new vm.SyntheticModule(
    exportNames,
    function () {
      for (const key of exportNames) this.setExport(key, hostModule[key]);
    },
    {
      context: ctx,
      identifier: specifier,
    },
  );

  await synth.link(() => {
    throw new Error('node: built-in modules should not have dependencies');
  });
  await synth.evaluate();

  cache.set(specifier, synth);
  return synth;
}

/**
 * Resolve, link, and evaluate an ESM module fetched from a URL.
 * Used as the `importModuleDynamically` handler for vm.Script,
 * enabling `await import('https://esm.sh/...')` inside sandbox scripts.
 *
 * Modules are cached per-agent so repeated imports are instant.
 */
async function resolveModule(
  specifier: string,
  referencingIdentifier: string | undefined,
  ctx: vm.Context,
  cache: Map<string, vm.Module>,
): Promise<vm.Module> {
  // Handle node: built-in imports before URL resolution
  if (specifier.startsWith('node:')) {
    return resolveNodeModule(specifier, ctx, cache);
  }

  const resolved = referencingIdentifier
    ? new URL(specifier, referencingIdentifier).href
    : specifier;

  if (!resolved.startsWith('https://')) {
    throw new Error(
      `Dynamic import only supports node: built-ins and https:// URLs. Got: ${resolved}`,
    );
  }

  const cached = cache.get(resolved);
  if (cached) return cached;

  const response = await fetch(resolved);
  if (!response.ok)
    throw new Error(
      `Failed to fetch module: ${resolved} (HTTP ${response.status})`,
    );

  const source = await response.text();

  const mod = new vm.SourceTextModule(source, {
    context: ctx,
    identifier: resolved,
    importModuleDynamically: (spec: string) =>
      resolveModule(spec, resolved, ctx, cache),
  });

  await mod.link((importSpec: string) =>
    resolveModule(importSpec, resolved, ctx, cache),
  );
  await mod.evaluate();

  cache.set(resolved, mod);
  return mod;
}

ipc.onMessage(async (msg) => {
  switch (msg.type) {
    case 'create-context': {
      const ctx = vm.createContext({
        API: getSandboxAPI(msg.agentId),
        ...getContextGlobals(),
      });
      contexts.set(msg.agentId, ctx);
      moduleCaches.set(msg.agentId, new Map());
      break;
    }
    case 'destroy-context': {
      contexts.delete(msg.agentId);
      moduleCaches.delete(msg.agentId);
      break;
    }
    case 'execute': {
      const ctx = contexts.get(msg.agentId);
      if (!ctx) {
        ipc.send({ type: 'result', id: msg.id, error: 'No context' });
        return;
      }

      let timeoutId: NodeJS.Timeout | undefined;
      let scriptPromise: Promise<unknown> | undefined;

      try {
        const wrapped = `(async () => { ${msg.code} })()`;
        const cache = moduleCaches.get(msg.agentId) ?? new Map();
        const script = new vm.Script(wrapped, {
          importModuleDynamically: (specifier: string) =>
            resolveModule(specifier, undefined, ctx, cache),
        });
        // Sync timeout (30s) catches infinite synchronous loops (e.g. while(true){}).
        scriptPromise = script.runInContext(ctx, { timeout: 30_000 });

        // Async timeout (30s) catches long-running async work (awaits, fetches, etc.)
        const ASYNC_TIMEOUT_MS = 30_000;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                `Script execution timed out after ${ASYNC_TIMEOUT_MS / 1_000}s`,
              ),
            );
          }, ASYNC_TIMEOUT_MS);
        });

        const value = await Promise.race([scriptPromise, timeoutPromise]);
        clearTimeout(timeoutId);

        ipc.send({ type: 'result', id: msg.id, value });
      } catch (err) {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        if (scriptPromise) scriptPromise.catch(() => {});
        ipc.send({
          type: 'result',
          id: msg.id,
          error: err instanceof Error ? err.message : String(err),
          errorStack: err instanceof Error ? err.stack : undefined,
        });
      }
      break;
    }
    case 'cdp-result': {
      const p = pendingCdp.get(msg.id);
      if (!p) return;
      pendingCdp.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.result);
      break;
    }
    case 'write-file-result': {
      const p = pendingFileOps.get(msg.id);
      if (!p) return;
      pendingFileOps.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.result!);
      break;
    }
    case 'get-attachment-result': {
      const p = pendingAttachmentOps.get(msg.id);
      if (!p) return;
      pendingAttachmentOps.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error));
      else if (msg.result) {
        // Decode base64 content back to Buffer
        p.resolve({
          id: msg.result.id,
          fileName: msg.result.fileName,
          mediaType: msg.result.mediaType,
          content: Buffer.from(msg.result.content, 'base64'),
        });
      }
      break;
    }
  }
});
