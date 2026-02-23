import type { Logger } from '@/services/logger';
import type { DiffHistoryService } from '@/services/diff-history';
import type { TelemetryService } from '@/services/telemetry';
import type { KartonService } from '@/services/karton';
import type { MountManagerService } from '../services/mount-manager';
import type { SandboxFileWriter, AttachmentResolver } from '../../sandbox';
import {
  MAX_IMAGE_SIZE,
  MAX_DOCUMENT_SIZE,
} from '@shared/karton-contracts/ui/shared-types';
import type { ClientRuntimeNode } from '@stagewise/agent-runtime-node';
import {
  buildAgentFileEditContent,
  captureFileState,
  cleanupTempFile,
} from '.';
import path from 'node:path';
import fs from 'node:fs/promises';

interface FileWriterDeps {
  mountManager: MountManagerService;
  diffHistoryService: DiffHistoryService;
  logger: Logger;
  telemetryService: TelemetryService;
  tempDir: string;
}

export function createSandboxFileWriter(
  deps: FileWriterDeps,
): SandboxFileWriter {
  return async (agentId, relativePath, content, toolCallId) => {
    const mountsWithRt = deps.mountManager.getMountedPathsWithRuntimes(agentId);
    if (!mountsWithRt || mountsWithRt.length === 0)
      throw new Error('No mounted workspaces found');

    const mountPrefixMatch = relativePath.match(/^(w\d+)\//);
    let clientRuntime: ClientRuntimeNode | undefined;
    let strippedPath = relativePath;

    if (mountPrefixMatch) {
      const prefix = mountPrefixMatch[1];
      strippedPath = relativePath.slice(prefix.length + 1);
      const mount = mountsWithRt.find((m) => m.prefix === prefix);
      clientRuntime = mount?.clientRuntime;
    } else if (mountsWithRt.length > 0) {
      clientRuntime = mountsWithRt[0].clientRuntime;
    }

    if (!clientRuntime) throw new Error('No workspace connected');

    const absolutePath = clientRuntime.fileSystem.resolvePath(strippedPath);
    const workspaceRoot = clientRuntime.fileSystem.getCurrentWorkingDirectory();

    if (!absolutePath.startsWith(workspaceRoot))
      throw new Error('Path must be within workspace');

    const beforeState = await captureFileState(absolutePath, deps.tempDir);

    const parentDir = path.dirname(absolutePath);
    await fs.mkdir(parentDir, { recursive: true });
    deps.diffHistoryService.ignoreFileForWatcher(absolutePath);
    await fs.writeFile(absolutePath, content);

    const afterState = await captureFileState(absolutePath, deps.tempDir);

    try {
      const { editContent, tempFilesToCleanup } =
        await buildAgentFileEditContent(beforeState, afterState, deps.tempDir);

      if (!editContent.isExternal && editContent.contentAfter !== null) {
        void deps.mountManager.syncFileWithLsp(
          agentId,
          absolutePath,
          editContent.contentAfter,
        );
      }

      await deps.diffHistoryService.registerAgentEdit({
        agentInstanceId: agentId,
        path: absolutePath,
        toolCallId,
        ...editContent,
      });

      for (const tempFile of tempFilesToCleanup) {
        void cleanupTempFile(tempFile);
      }
    } catch (error) {
      deps.logger.error(
        '[ToolboxService] Failed to register sandbox file write',
        { error, path: absolutePath, toolCallId },
      );
      deps.telemetryService.captureException(error as Error, {
        service: 'toolbox',
        operation: 'registerSandboxWrite',
        path: absolutePath,
        toolCallId,
      });
    } finally {
      setTimeout(
        () => deps.diffHistoryService.unignoreFileForWatcher(absolutePath),
        500,
      );
    }

    return { success: true as const, bytesWritten: content.length };
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
