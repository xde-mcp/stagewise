import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

export type ApiKeyProvider = 'anthropic' | 'openai' | 'google';

export type ApiKeyValidationResult =
  | null
  | { success: true }
  | { success: false; error: string };

export type ApiKeyValidationResults = Record<
  ApiKeyProvider,
  ApiKeyValidationResult
>;

export type ApiKeysInput = Partial<Record<ApiKeyProvider, string>>;

const providerConfigs: Record<
  ApiKeyProvider,
  (apiKey: string) => Parameters<typeof generateText>[0]['model']
> = {
  anthropic: (apiKey) => createAnthropic({ apiKey })('claude-haiku-4-5'),
  openai: (apiKey) => createOpenAI({ apiKey })('gpt-4o-mini'),
  google: (apiKey) =>
    createGoogleGenerativeAI({ apiKey })('gemini-2.0-flash-lite'),
};

/**
 * Validate API keys by making a lightweight test request to each provider.
 * Keys that are empty/undefined are skipped (result stays `null`).
 */
export async function validateApiKeys(
  keys: ApiKeysInput,
): Promise<ApiKeyValidationResults> {
  const results: ApiKeyValidationResults = {
    anthropic: null,
    openai: null,
    google: null,
  };

  const promises: Promise<void>[] = [];

  for (const [provider, apiKey] of Object.entries(keys)) {
    if (!apiKey) continue;
    const k = provider as ApiKeyProvider;
    const model = providerConfigs[k](apiKey);

    const p = generateText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is the capital of France? Respond with one word.',
        },
      ],
    })
      .then(() => {
        results[k] = { success: true };
      })
      .catch((err) => {
        results[k] = {
          success: false,
          error: `Invalid ${k} provider key: ${err instanceof Error ? err.message : String(err)}`,
        };
      });

    promises.push(p);
  }

  await Promise.all(promises);
  return results;
}
