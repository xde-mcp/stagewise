/**
 * Duck-typed interface for an Electron UtilityProcess instance on the main side.
 * Using a structural type avoids importing 'electron' directly, which would
 * break the separately-bundled worker script.
 */
interface UtilityProcessHandle {
  postMessage(msg: any): void;
  on(event: 'message', handler: (data: any) => void): this;
  on(event: string, handler: (...args: any[]) => void): this;
}

export interface MountDescriptor {
  prefix: string;
  absolutePath: string;
}

export type MainToWorkerMessage =
  | { type: 'create-context'; agentId: string }
  | { type: 'destroy-context'; agentId: string }
  | { type: 'execute'; id: string; agentId: string; code: string }
  | { type: 'cdp-result'; id: string; result?: unknown; error?: string }
  | {
      type: 'update-mounts';
      agentId: string;
      mounts: MountDescriptor[];
    }
  | {
      type: 'get-attachment-result';
      id: string;
      result?: {
        id: string;
        fileName: string;
        mediaType: string;
        content: string; // base64-encoded Buffer
      };
      error?: string;
    };

export type WorkerToMainMessage =
  | {
      type: 'cdp';
      id: string;
      tabId: string;
      method: string;
      params?: Record<string, unknown>;
    }
  | {
      type: 'result';
      id: string;
      value?: unknown;
      error?: string;
      errorStack?: string;
      outputs?: string[];
      customFileAttachments?: Array<{
        id: string;
        mediaType: string;
        fileName?: string;
        url: string;
      }>;
    }
  | {
      type: 'file-diff-notification';
      agentId: string;
      absolutePath: string;
      before: string | null;
      after: string | null;
      isExternal: boolean;
      bytesWritten: number;
    }
  | {
      type: 'get-attachment';
      id: string;
      agentId: string;
      attachmentId: string;
    };

/** Main-side: typed send + onMessage for a UtilityProcess child */
export function createMainIPC(child: UtilityProcessHandle) {
  return {
    send(msg: MainToWorkerMessage) {
      child.postMessage(msg);
    },
    onMessage(handler: (msg: WorkerToMainMessage) => void) {
      child.on('message', handler);
    },
  };
}

/** Worker-side: typed send + onMessage via process.parentPort (Electron Utility Process) */
export function createWorkerIPC() {
  // In an Electron utility process, process.parentPort is the IPC channel to the main process.
  // It's not exported from the 'electron' module — it's a property on the process object.
  const parentPort = (process as any).parentPort as {
    postMessage(msg: any): void;
    on(
      event: 'message',
      handler: (e: { data: any; ports: any[] }) => void,
    ): void;
  };

  if (!parentPort) {
    throw new Error(
      'process.parentPort is not available. ' +
        'This script must be spawned via Electron utilityProcess.fork().',
    );
  }

  return {
    send(msg: WorkerToMainMessage) {
      parentPort.postMessage(msg);
    },
    onMessage(handler: (msg: MainToWorkerMessage) => void) {
      // parentPort 'message' event wraps data in { data, ports }
      parentPort.on('message', (e) => handler(e.data));
    },
  };
}
