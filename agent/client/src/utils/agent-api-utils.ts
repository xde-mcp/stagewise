import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Tools } from '@stagewise/agent-types';

/**
 * Maps Zod schema tools to JSON schema format for the API
 */
export function mapZodToolsToJsonSchemaTools(
  tools: Tools,
): Record<string, { description: string; parameters: any }> {
  return Object.entries(tools).reduce(
    (acc, [key, value]) => {
      acc[key] = {
        description: value.description ?? `Tool: ${key}`,
        parameters: zodToJsonSchema(value.parameters),
      };
      return acc;
    },
    {} as Record<string, { description: string; parameters: any }>,
  );
}
