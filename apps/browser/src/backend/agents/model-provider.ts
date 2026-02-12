import type { TelemetryService } from '@/services/telemetry';
import type { ModelId } from '@shared/available-models';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { availableModels } from '@shared/available-models';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { AuthService } from '@/services/auth';
import type { streamText } from 'ai';

/**
 * This class offers a getter for a model that is traced with the telemetry service.
 *
 * It automatically routes the model to the correct provider and with the correct API key based on the users configuration of the model's provider.
 */
export class ModelProviderService {
  private readonly telemetryService: TelemetryService;
  private readonly authService: AuthService;

  public constructor(
    telemetryService: TelemetryService,
    authService: AuthService,
  ) {
    this.telemetryService = telemetryService;
    this.authService = authService;
  }

  // TODO: Add configurable base url and api key for each provider based on the user's configuration in preferences

  /**
   * Get a model usable by AI-SDK alongside provider options and headers that should be sent for auth.
   * The returned model includes tracing using the telemetry service (only active if the preferences are configured accordingly).
   *
   * The model routes to the user configured endpoint (right now, our proxy is used, but we want to support custom endpoints and api keys).
   *
   * @param modelId - The model ID to get.
   * @param traceId - The trace ID to use for tracing.
   * @param otherPostHogProperties - Other properties to add to the posthog properties.
   * @returns
   */
  public getModelWithOptions(
    modelId: ModelId,
    traceId: string,
    otherPostHogProperties?: Record<string, unknown>,
  ): {
    model: LanguageModelV3;
    providerOptions: Parameters<typeof streamText>[0]['providerOptions'];
    headers: Record<string, string>;
    contextWindowSize: number;
  } {
    const accessToken = this.authService.accessToken ?? '';

    const baseUrl = process.env.LLM_PROXY_URL || 'https://llm.stagewise.io';
    const modelSettings = availableModels.find((m) => m.modelId === modelId);
    if (!modelSettings) throw new Error(`Model ${modelId} not found`);

    const headers = modelSettings.headers;

    switch (modelSettings.modelId) {
      // Anthropic models - use Anthropic passthrough
      case 'claude-opus-4-5':
      case 'claude-sonnet-4-5':
      case 'claude-haiku-4-5': {
        const anthropicProvider = createAnthropic({
          apiKey: accessToken,
          baseURL: `${baseUrl}/anthropic/v1`,
        });
        return {
          model: this.telemetryService.withTracing(
            anthropicProvider(modelSettings.modelId),
            {
              posthogTraceId: traceId,
              posthogProperties: {
                posthogTraceId: traceId,
                modelId: modelSettings.modelId,
                ...otherPostHogProperties,
              },
            },
          ),
          headers,
          providerOptions: {
            anthropic: { ...modelSettings.providerOptions },
          },
          contextWindowSize: modelSettings.modelContextRaw,
        };
      }

      // OpenAI models - use OpenAI passthrough
      case 'gpt-5.2':
      case 'gpt-5.1-codex-max': {
        const openaiProvider = createOpenAI({
          apiKey: accessToken,
          baseURL: `${baseUrl}/openai/v1`,
        });
        return {
          model: this.telemetryService.withTracing(
            openaiProvider(modelSettings.modelId),
            {
              posthogTraceId: traceId,
              posthogProperties: {
                posthogTraceId: traceId,
                modelId: modelSettings.modelId,
                ...otherPostHogProperties,
              },
            },
          ),
          headers,
          providerOptions: { openai: { ...modelSettings.providerOptions } },
          contextWindowSize: modelSettings.modelContextRaw,
        };
      }

      // Google models - use Gemini passthrough
      case 'gemini-3-pro-preview': {
        const googleProvider = createGoogleGenerativeAI({
          apiKey: accessToken,
          baseURL: `${baseUrl}/gemini/v1beta`,
        });
        return {
          model: this.telemetryService.withTracing(
            googleProvider(modelSettings.modelId),
            {
              posthogTraceId: traceId,
              posthogProperties: {
                posthogTraceId: traceId,
                modelId: modelSettings.modelId,
                ...otherPostHogProperties,
              },
            },
          ),
          headers,
          providerOptions: { google: { ...modelSettings.providerOptions } },
          contextWindowSize: modelSettings.modelContextRaw,
        };
      }

      default: {
        // Fallback to first model (Anthropic) with passthrough
        const fallbackModel = availableModels[0];
        const anthropicProvider = createAnthropic({
          apiKey: accessToken,
          baseURL: `${baseUrl}/anthropic/v1`,
        });
        return {
          model: this.telemetryService.withTracing(
            anthropicProvider(fallbackModel.modelId),
            {
              posthogTraceId: traceId,
              posthogProperties: {
                posthogTraceId: traceId,
                modelId: fallbackModel.modelId,
                ...otherPostHogProperties,
              },
            },
          ),
          headers: fallbackModel.headers,
          providerOptions: {
            anthropic: { ...fallbackModel.providerOptions },
          },
          contextWindowSize: fallbackModel.modelContextRaw,
        };
      }
    }
  }
}
