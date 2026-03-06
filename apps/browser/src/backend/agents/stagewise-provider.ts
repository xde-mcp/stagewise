import type { JSONObject } from '@ai-sdk/provider';
import {
  createOpenAICompatible,
  type MetadataExtractor,
  type OpenAICompatibleProvider,
} from '@ai-sdk/openai-compatible';

/**
 * Metadata extractor that captures the full response body as provider
 * metadata, preserving all keys from the API response as-is.
 */
const stagewiseMetadataExtractor: MetadataExtractor = {
  extractMetadata: async ({ parsedBody }) =>
    (parsedBody as Record<string, JSONObject>) ?? {},
  createStreamExtractor: () => {
    const accumulated: Record<string, JSONObject> = {};
    return {
      processChunk(parsedChunk: unknown) {
        const chunk = parsedChunk as Record<string, unknown>;
        for (const [key, value] of Object.entries(chunk)) {
          if (value != null && typeof value === 'object') {
            accumulated[key] = {
              ...(accumulated[key] ?? {}),
              ...(value as JSONObject),
            };
          } else if (value != null) {
            accumulated[key] = value as JSONObject;
          }
        }
      },
      buildMetadata: () => accumulated,
    };
  },
};

export type StagewiseProviderSettings = {
  apiKey: string;
  baseURL: string;
};

/**
 * Create a stagewise gateway provider that uses OpenAI-compatible
 * chat completions endpoints.
 *
 * Provider options are forwarded under the `stagewise` key and
 * response metadata is extracted under the same key.
 *
 * Message-level metadata (e.g. `cache_control`) is forwarded via the
 * built-in `openaiCompatible` providerOptions key which the SDK
 * spreads directly onto each message in the request body.
 */
export function createStagewise(
  settings: StagewiseProviderSettings,
): OpenAICompatibleProvider {
  return createOpenAICompatible({
    name: 'stagewise',
    apiKey: settings.apiKey,
    baseURL: settings.baseURL,
    metadataExtractor: stagewiseMetadataExtractor,
  });
}
