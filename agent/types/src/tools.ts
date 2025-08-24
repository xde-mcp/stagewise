import type { Tool } from 'ai';
import { z } from 'zod';

export type { Tool };

export const stagewiseToolMetadataSchema = z.object({
  requiresUserInteraction: z.boolean().default(false).optional(),
  runtime: z.enum(['client', 'server', 'browser']).default('client').optional(),
});

export type StagewiseToolMetadata = z.infer<typeof stagewiseToolMetadataSchema>;

export type FileModifyDiff = {
  path: string;
  changeType: 'modify';
  before: string;
  after: string;
};

export type FileCreateDiff = {
  path: string;
  changeType: 'create';
  after: string;
};

export type FileDeleteDiff = {
  path: string;
  changeType: 'delete';
  before: string;
};

export type FileDiff = FileModifyDiff | FileCreateDiff | FileDeleteDiff;

export type ToolResult = {
  undoExecute?: () => Promise<void>;
  success: boolean;
  error?: string;
  message?: string;
  result?: any;
  diff?: FileDiff;
};

export type Tools = Record<
  string,
  Tool<any, ToolResult> & {
    stagewiseMetadata?: StagewiseToolMetadata;
  }
>;
