import { z } from 'zod';
import { selectedElementSchema } from '../../../selected-elements';

/**
 * Schema for file attachments.
 * These are stored in metadata so the agent can correlate @{id} references
 * in the user message with the full file content. The backend will convert those to FileUIParts.
 */
export const fileAttachmentSchema = z.object({
  // Those are stagewise-specific properties
  id: z.string(),
  // Those are all FileUIPart properties
  mediaType: z.string(),
  fileName: z.string().optional(),
  url: z.string(),
  providerMetadata: z.object().optional(),
  /** Validation error message if file is unsupported (type or size) */
  validationError: z.string().optional(),
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

const metadataSchema = z.object({
  createdAt: z.date(),
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
  /** All file attachments for the message, containing data. We use this to fuly control how data get's attached in the final message. */
  fileAttachments: z.array(fileAttachmentSchema).optional(),
});

export type UserMessageMetadata = z.infer<typeof metadataSchema>;
