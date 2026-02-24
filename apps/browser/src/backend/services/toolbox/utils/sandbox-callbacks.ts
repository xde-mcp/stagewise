import type { Logger } from '@/services/logger';
import type { DiffHistoryService } from '@/services/diff-history';
import type { TelemetryService } from '@/services/telemetry';
import type { KartonService } from '@/services/karton';
import type { MountManagerService } from '../services/mount-manager';
import type { FileDiffHandler, AttachmentResolver } from '../../sandbox';
import {
  MAX_IMAGE_SIZE,
  MAX_DOCUMENT_SIZE,
} from '@shared/karton-contracts/ui/shared-types';

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

interface AttachmentResolverDeps {
  uiKarton: KartonService;
}

export function createAttachmentResolver(
  deps: AttachmentResolverDeps,
): AttachmentResolver {
  return async (agentId, attachmentId) => {
    const agentInstance = deps.uiKarton.state.agents.instances[agentId];
    if (!agentInstance)
      throw new Error('Agent not found or has no message history');

    const history = agentInstance.state.history;
    if (!history || history.length === 0)
      throw new Error('Agent not found or has no message history');

    for (const message of history) {
      if (message.role !== 'user') continue;

      const fileAttachments = message.metadata?.fileAttachments;
      if (!fileAttachments) continue;

      const attachment = fileAttachments.find((f) => f.id === attachmentId);
      if (!attachment) continue;

      if (attachment.validationError)
        throw new Error(
          `Attachment is not supported: ${attachment.validationError}`,
        );

      if (!attachment.url) throw new Error('Attachment has no data URL');

      const dataUrlMatch = attachment.url.match(/^data:([^;]+);base64,(.+)$/);
      if (!dataUrlMatch)
        throw new Error('Attachment has invalid data URL format');

      const content = Buffer.from(dataUrlMatch[2], 'base64');

      const isImage = attachment.mediaType.startsWith('image/');
      const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_DOCUMENT_SIZE;
      const maxSizeLabel = isImage ? '5MB' : '20MB';

      if (content.length > maxSize)
        throw new Error(
          `${isImage ? 'Image' : 'Document'} attachment exceeds ${maxSizeLabel} limit`,
        );

      return {
        id: attachment.id,
        fileName: attachment.fileName ?? 'attachment',
        mediaType: attachment.mediaType,
        content,
      };
    }

    throw new Error(
      `Attachment with ID "${attachmentId}" not found in conversation`,
    );
  };
}
