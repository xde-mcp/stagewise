import type { Tool } from 'ai';
import { z } from 'zod';

export type { Tool };

export const stagewiseToolMetadataSchema = z.object({
  requiresUserInteraction: z.boolean().default(false).optional(),
  runtime: z.enum(['client', 'server', 'browser']).default('client').optional(),
  type: z.undefined(),
});

export type StagewiseToolMetadata = z.infer<typeof stagewiseToolMetadataSchema>;

export type Tools = Record<
  string,
  Tool<any, any> & { stagewiseMetadata?: StagewiseToolMetadata }
>;
