import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream, type ReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { getAgentAttachmentsDir, getAgentAttachmentPath } from './paths';

export function getAgentBlobDir(agentId: string): string {
  return getAgentAttachmentsDir(agentId);
}

export function getBlobPath(agentId: string, attachmentId: string): string {
  return getAgentAttachmentPath(agentId, attachmentId);
}

/**
 * Write attachment content to disk using temp-then-rename for atomicity.
 * Accepts either a Buffer (for IPC-transferred data) or a filesystem path
 * (for direct copy from a dropped file).
 */
export async function writeBlob(
  agentId: string,
  attachmentId: string,
  source: Buffer | string,
): Promise<void> {
  const dir = getAgentAttachmentsDir(agentId);
  await fs.mkdir(dir, { recursive: true });

  const finalPath = getAgentAttachmentPath(agentId, attachmentId);
  const tempPath = path.join(dir, `tmp-${randomUUID()}`);

  try {
    if (typeof source === 'string') {
      await fs.copyFile(source, tempPath);
    } else {
      await fs.writeFile(tempPath, source);
    }
    await fs.rename(tempPath, finalPath);
  } catch (err) {
    await fs.unlink(tempPath).catch(() => {});
    throw err;
  }
}

export async function readBlob(
  agentId: string,
  attachmentId: string,
): Promise<Buffer> {
  const filePath = getAgentAttachmentPath(agentId, attachmentId);
  return fs.readFile(filePath);
}

export function readBlobStream(
  agentId: string,
  attachmentId: string,
): ReadStream {
  const filePath = getAgentAttachmentPath(agentId, attachmentId);
  return createReadStream(filePath);
}

export async function deleteAgentBlobs(agentId: string): Promise<void> {
  const dir = getAgentAttachmentsDir(agentId);
  await fs.rm(dir, { recursive: true, force: true });
}

export async function blobExists(
  agentId: string,
  attachmentId: string,
): Promise<boolean> {
  try {
    await fs.access(getAgentAttachmentPath(agentId, attachmentId));
    return true;
  } catch {
    return false;
  }
}
