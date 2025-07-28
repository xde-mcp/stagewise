import { coreMessageSchema, type CoreMessage } from 'ai';
import { z } from 'zod';

export const sythenticCoreMessageSchema = z.intersection(
  coreMessageSchema,
  z.object({
    synthetic: z.literal(true),
  }),
);

export type { CoreMessage };
