import path from 'node:path';
import fs from 'node:fs/promises';
import { app } from 'electron';

// ---------------------------------------------------------------------------
// Root directories
// ---------------------------------------------------------------------------

export const getDataRoot = (): string =>
  path.join(app.getPath('userData'), 'stagewise');

export const getTempRoot = (): string =>
  path.join(app.getPath('temp'), 'stagewise');

// ---------------------------------------------------------------------------
// SQLite database paths
// ---------------------------------------------------------------------------

export type DbName = 'favicon' | 'web-data' | 'history' | 'thumbnails';

export const getDbPath = (name: DbName): string =>
  path.join(getDataRoot(), `${name}.sqlite`);

export const getAgentDbPath = (): string =>
  path.join(getDataRoot(), 'agents', 'instances.sqlite');

export const getDiffHistoryDbPath = (): string =>
  path.join(getDataRoot(), 'diff-history', 'data.sqlite');

// ---------------------------------------------------------------------------
// JSON persisted-data paths
// ---------------------------------------------------------------------------

export type JsonName =
  | 'config'
  | 'identity'
  | 'auth-session'
  | 'credentials'
  | 'preferences'
  | 'recently-opened-workspaces'
  | 'onboarding-state'
  | 'downloads-state'
  | 'window-state';

export const getJsonPath = (name: JsonName): string =>
  path.join(getDataRoot(), `${name}.json`);

// ---------------------------------------------------------------------------
// Agent-scoped directories
// ---------------------------------------------------------------------------

export const getAgentsDir = (): string => path.join(getDataRoot(), 'agents');

export const getAgentDir = (agentId: string): string =>
  path.join(getDataRoot(), 'agents', agentId);

export const getAgentAttachmentsDir = (agentId: string): string =>
  path.join(getDataRoot(), 'agents', agentId, 'data-attachments');

export const getAgentAttachmentPath = (
  agentId: string,
  attachmentId: string,
): string =>
  path.join(getDataRoot(), 'agents', agentId, 'data-attachments', attachmentId);

export const getAgentAppsDir = (agentId: string): string =>
  path.join(getDataRoot(), 'agents', agentId, 'apps');

// ---------------------------------------------------------------------------
// Diff-history directories
// ---------------------------------------------------------------------------

export const getDiffHistoryDir = (): string =>
  path.join(getDataRoot(), 'diff-history');

export const getDiffHistoryBlobsDir = (): string =>
  path.join(getDataRoot(), 'diff-history', 'data-blobs');

// ---------------------------------------------------------------------------
// Binary paths (e.g. ripgrep)
// ---------------------------------------------------------------------------

export const getRipgrepBasePath = (): string => path.join(getDataRoot(), 'bin');

// ---------------------------------------------------------------------------
// Directory bootstrapping
// ---------------------------------------------------------------------------

export async function ensureDataDirectories(): Promise<void> {
  await Promise.all([
    fs.mkdir(getDataRoot(), { recursive: true }),
    fs.mkdir(getTempRoot(), { recursive: true }),
    fs.mkdir(getAgentsDir(), { recursive: true }),
    fs.mkdir(getDiffHistoryDir(), { recursive: true }),
    fs.mkdir(getRipgrepBasePath(), { recursive: true }),
  ]);
}
