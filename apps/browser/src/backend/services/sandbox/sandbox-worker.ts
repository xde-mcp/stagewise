import vm from 'node:vm';
import { createWorkerIPC } from './ipc';

const contexts = new Map<string, vm.Context>();
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
        API: getSandboxAPI(msg.agentId),
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
