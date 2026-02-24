import { z } from 'zod';
import { selectedElementSchema } from '../../../selected-elements';
import { environmentDiffSnapshotSchema } from '../shared-types';

/**
 * Schema for file attachments.
 * Lightweight metadata only — binary content is stored on disk at
 * `{globalDataPath}/attachment-blobs/{agentId}/{attachmentId}`.
 * The backend reads blobs from disk when building LLM prompts.
 * Agents access attachments via `fs.readFile('att/{id}')` in the sandbox.
 */
export const fileAttachmentSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  mediaType: z.string(),
  sizeBytes: z.number(),
});

export type FileAttachment = z.infer<typeof fileAttachmentSchema>;

/**
 * Schema for text clip attachments - collapsed long text pasted by user.
 * These are stored in metadata so the agent can correlate @{id} references
 * in the user message with the full text content.
 */
export const textClipAttachmentSchema = z.object({
  /** Unique identifier matching the @{id} reference in user message */
  id: z.string(),
  /** Truncated preview label shown in UI */
  label: z.string(),
  /** Full pasted text content */
  content: z.string(),
});

export type TextClipAttachment = z.infer<typeof textClipAttachmentSchema>;

export const browserTabSnapshotSchema = z.object({
  handle: z.string(),
  url: z.string(),
  title: z.string(),
});

export type BrowserTabSnapshot = z.infer<typeof browserTabSnapshotSchema>;

export const browserSnapshotSchema = z.object({
  tabs: z.array(browserTabSnapshotSchema),
  activeTabHandle: z.string().nullable(),
});

export type BrowserSnapshot = z.infer<typeof browserSnapshotSchema>;

export const mountSchema = z.object({
  prefix: z.string(),
  path: z.string(),
});

export type Mount = z.infer<typeof mountSchema>;

export const workspaceSnapshotSchema = z.object({
  mounts: z.array(mountSchema),
});

export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>;

export const environmentSnapshotSchema = z.object({
  browser: browserSnapshotSchema,
  workspace: workspaceSnapshotSchema,
  fileDiffs: environmentDiffSnapshotSchema,
});

export type EnvironmentSnapshot = z.infer<typeof environmentSnapshotSchema>;

const metadataSchema = z.object({
  createdAt: z.date(),
  /** Mounted workspace paths captured at message creation time for persistent file links. */
  mountedPaths: z.array(mountSchema).optional(),
  partsMetadata: z.array(
    z
      .object({ startedAt: z.date().optional(), endedAt: z.date().optional() })
      .optional(),
  ), // Metadata for each part of the message - indexed accordingly
  selectedPreviewElements: z.array(selectedElementSchema).optional(),
  /** Text clip attachments - collapsed long text pasted by user */
  textClipAttachments: z.array(textClipAttachmentSchema).optional(),
  /** Compressed history of the agent in markdown format. Contains information about the whole previous conversation. */
  compressedHistory: z.string().optional(),
  /** Lightweight file attachment metadata (content stored on disk). */
  fileAttachments: z.array(fileAttachmentSchema).optional(),
  /** Snapshot of browser, workspace, and file-diff state at message creation time. Used to compute environment change descriptions between agent turns. */
  environmentSnapshot: environmentSnapshotSchema.optional(),
});

export type UserMessageMetadata = z.infer<typeof metadataSchema>;
