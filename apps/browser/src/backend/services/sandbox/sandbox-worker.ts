import vm from 'node:vm';
import { createWorkerIPC } from './ipc';

const contexts = new Map<string, vm.Context>();
const pendingCdp = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
>();
const ipc = createWorkerIPC();
let cdpReqId = 0;

function getSandboxAPI() {
  return {
    sendCDP(tabId: string, method: string, params?: any) {
      const id = `${cdpReqId++}`;
      return new Promise((resolve, reject) => {
        pendingCdp.set(id, { resolve, reject });
        ipc.send({ type: 'cdp', id, tabId, method, params });
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
  return {
    // Timers
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
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
  };
}

ipc.onMessage(async (msg) => {
  switch (msg.type) {
    case 'create-context': {
      const ctx = vm.createContext({
        API: getSandboxAPI(),
        ...getContextGlobals(),
      });
      contexts.set(msg.agentId, ctx);
      break;
    }
    case 'destroy-context': {
      contexts.delete(msg.agentId);
      break;
    }
    case 'execute': {
      const ctx = contexts.get(msg.agentId);
      if (!ctx) {
        ipc.send({ type: 'result', id: msg.id, error: 'No context' });
        return;
      }
      try {
        const wrapped = `(async () => { ${msg.code} })()`;
        // Sync timeout (5s) catches infinite synchronous loops (e.g. while(true){}).
        // The async IIFE itself returns a Promise nearly instantly, so 5s is generous.
        const promise = vm.runInContext(wrapped, ctx, { timeout: 5_000 });

        // Async timeout (30s) catches long-running async work (awaits, fetches, etc.)
        const ASYNC_TIMEOUT_MS = 30_000;
        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                `Script execution timed out after ${ASYNC_TIMEOUT_MS / 1_000}s`,
              ),
            );
          }, ASYNC_TIMEOUT_MS);
        });

        const value = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId!);

        ipc.send({ type: 'result', id: msg.id, value });
      } catch (err) {
        ipc.send({
          type: 'result',
          id: msg.id,
          error: err instanceof Error ? err.message : String(err),
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
  }
});
