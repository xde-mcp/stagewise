import path from 'node:path';
import fs from 'node:fs/promises';
import { createReadStream, type ReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';

const BLOB_ROOT_DIR = 'attachment-blobs';

export function getAttachmentBlobDir(globalDataPath: string): string {
  return path.join(globalDataPath, BLOB_ROOT_DIR);
}

export function getAgentBlobDir(
  globalDataPath: string,
  agentId: string,
): string {
  return path.join(globalDataPath, BLOB_ROOT_DIR, agentId);
}

export function getBlobPath(
  globalDataPath: string,
  agentId: string,
  attachmentId: string,
): string {
  return path.join(globalDataPath, BLOB_ROOT_DIR, agentId, attachmentId);
}

/**
 * Write attachment content to disk using temp-then-rename for atomicity.
 * Accepts either a Buffer (for IPC-transferred data) or a filesystem path
 * (for direct copy from a dropped file).
 */
export async function writeBlob(
  globalDataPath: string,
  agentId: string,
  attachmentId: string,
  source: Buffer | string,
): Promise<void> {
  const dir = getAgentBlobDir(globalDataPath, agentId);
  await fs.mkdir(dir, { recursive: true });

  const finalPath = getBlobPath(globalDataPath, agentId, attachmentId);
  const tempPath = path.join(dir, `tmp-${randomUUID()}`);

  try {
    if (typeof source === 'string') {
      await fs.copyFile(source, tempPath);
    } else {
      await fs.writeFile(tempPath, source);
    }
    await fs.rename(tempPath, finalPath);
  } catch (err) {
    // Clean up temp file on failure
    await fs.unlink(tempPath).catch(() => {});
    throw err;
  }
}

export async function readBlob(
  globalDataPath: string,
  agentId: string,
  attachmentId: string,
): Promise<Buffer> {
  const filePath = getBlobPath(globalDataPath, agentId, attachmentId);
  return fs.readFile(filePath);
}

export function readBlobStream(
  globalDataPath: string,
  agentId: string,
  attachmentId: string,
): ReadStream {
  const filePath = getBlobPath(globalDataPath, agentId, attachmentId);
  return createReadStream(filePath);
}

export async function deleteAgentBlobs(
  globalDataPath: string,
  agentId: string,
): Promise<void> {
  const dir = getAgentBlobDir(globalDataPath, agentId);
  await fs.rm(dir, { recursive: true, force: true });
}

export async function blobExists(
  globalDataPath: string,
  agentId: string,
  attachmentId: string,
): Promise<boolean> {
  try {
    await fs.access(getBlobPath(globalDataPath, agentId, attachmentId));
    return true;
  } catch {
    return false;
  }
}
