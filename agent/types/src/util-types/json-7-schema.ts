import { z } from 'zod';

// Define a Zod schema that matches JSON Schema 7 structure
export const jsonSchema7Schema = z
  .object({
    $schema: z.string().optional(),
    $id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    type: z
      .enum([
        'null',
        'boolean',
        'object',
        'array',
        'number',
        'string',
        'integer',
      ])
      .optional(),
    properties: z.record(z.any()).optional(),
    required: z.array(z.string()).optional(),
    items: z.any().optional(),
    additionalProperties: z.union([z.boolean(), z.any()]).optional(),
    enum: z.array(z.any()).optional(),
    const: z.any().optional(),
    format: z.string().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    exclusiveMinimum: z.number().optional(),
    exclusiveMaximum: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
    minItems: z.number().optional(),
    maxItems: z.number().optional(),
    uniqueItems: z.boolean().optional(),
    minProperties: z.number().optional(),
    maxProperties: z.number().optional(),
    allOf: z.array(z.any()).optional(),
    anyOf: z.array(z.any()).optional(),
    oneOf: z.array(z.any()).optional(),
    not: z.any().optional(),
    if: z.any().optional(),
    // biome-ignore lint/suspicious/noThenProperty: JSON Schema 7 spec requires 'then' property
    then: z.any().optional(),
    else: z.any().optional(),
    // Allow additional properties for extensibility
  })
  .passthrough();
