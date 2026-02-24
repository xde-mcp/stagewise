import type { Logger } from '@/services/logger';
import type { DiffHistoryService } from '@/services/diff-history';
import type { TelemetryService } from '@/services/telemetry';
import type { MountManagerService } from '../services/mount-manager';
import type { FileDiffHandler } from '../../sandbox';

interface FileDiffHandlerDeps {
  mountManager: MountManagerService;
  diffHistoryService: DiffHistoryService;
  logger: Logger;
  telemetryService: TelemetryService;
}

/**
 * Creates a handler for file-diff-notification messages from the sandbox
 * worker. The worker captures before/after state in-process and sends
 * it via fire-and-forget IPC. This handler registers the edit with
 * diff-history and syncs with LSP.
 */
export function createFileDiffHandler(
  deps: FileDiffHandlerDeps,
): FileDiffHandler {
  return async (
    agentId,
    absolutePath,
    before,
    after,
    isExternal,
    _bytesWritten,
    toolCallId,
  ) => {
    deps.diffHistoryService.ignoreFileForWatcher(absolutePath);

    try {
      if (isExternal) {
        await deps.diffHistoryService.registerAgentEdit({
          agentInstanceId: agentId,
          path: absolutePath,
          toolCallId,
          isExternal: true,
          tempPathToBeforeContent: null,
          tempPathToAfterContent: null,
        });
      } else {
        // Sync with LSP for text content
        if (after !== null) {
          void deps.mountManager.syncFileWithLsp(agentId, absolutePath, after);
        } else if (before !== null) {
          void deps.mountManager.syncFileCloseWithLsp(agentId, absolutePath);
        }

        await deps.diffHistoryService.registerAgentEdit({
          agentInstanceId: agentId,
          path: absolutePath,
          toolCallId,
          isExternal: false,
          contentBefore: before,
          contentAfter: after,
        });
      }
    } catch (error) {
      deps.logger.error(
        '[ToolboxService] Failed to register sandbox file diff',
        { error, path: absolutePath, toolCallId },
      );
      deps.telemetryService.captureException(error as Error, {
        service: 'toolbox',
        operation: 'registerSandboxDiff',
        path: absolutePath,
        toolCallId,
      });
    } finally {
      setTimeout(
        () => deps.diffHistoryService.unignoreFileForWatcher(absolutePath),
        500,
      );
    }
  };
}
