import type { TelemetryService } from '@/services/telemetry';
import type { ModelId } from '@shared/available-models';
import type {
  ModelProvider,
  ApiSpec,
  CustomModel,
} from '@shared/karton-contracts/ui/shared-types';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { availableModels } from '@shared/available-models';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { AuthService } from '@/services/auth';
import type { PreferencesService } from '@/services/preferences';
import type { streamText } from 'ai';

/** Proxy sub-paths for each provider on the stagewise LLM proxy */
const PROVIDER_PROXY_PATHS: Record<ModelProvider, string> = {
  anthropic: 'anthropic/v1',
  openai: 'openai/v1',
  google: 'gemini/v1beta',
};

/**
 * This class offers a getter for a model that is traced with the telemetry service.
 *
 * It automatically routes the model to the correct provider and with the correct API key based on the users configuration of the model's provider.
 */
export class ModelProviderService {
  private readonly telemetryService: TelemetryService;
  private readonly authService: AuthService;
  private readonly preferencesService: PreferencesService;

  public constructor(
    telemetryService: TelemetryService,
    authService: AuthService,
    preferencesService: PreferencesService,
  ) {
    this.telemetryService = telemetryService;
    this.authService = authService;
    this.preferencesService = preferencesService;
  }

  private report(
    error: Error,
    operation: string,
    extra?: Record<string, unknown>,
  ) {
    this.telemetryService.captureException(error, {
      service: 'model-provider',
      operation,
      ...extra,
    });
  }

  /**
   * Resolve the API key and base URL for a provider based on user preferences.
   */
  private resolveProviderEndpoint(provider: ModelProvider): {
    apiKey: string;
    baseURL: string | undefined;
  } {
    const prefs = this.preferencesService.get();
    const config = prefs.providerConfigs[provider];
    const proxyBaseUrl =
      process.env.LLM_PROXY_URL || 'https://llm.stagewise.io';

    switch (config.mode) {
      case 'stagewise':
        return {
          apiKey: this.authService.accessToken ?? '',
          baseURL: `${proxyBaseUrl}/${PROVIDER_PROXY_PATHS[provider]}`,
        };
      case 'official':
        return {
          apiKey: this.preferencesService.decryptProviderApiKey(
            config.encryptedApiKey,
          ),
          baseURL: undefined, // AI SDK uses its built-in default
        };
      case 'custom':
        return {
          apiKey: this.preferencesService.decryptProviderApiKey(
            config.encryptedApiKey,
          ),
          baseURL: config.customBaseUrl,
        };
    }
  }

  /**
   * Resolve the API key, base URL, and API spec for a custom endpoint
   * or a built-in provider reference.
   */
  private resolveCustomEndpoint(endpointId: string): {
    apiKey: string;
    baseURL: string | undefined;
    apiSpec: ApiSpec;
  } {
    // Built-in provider reference — map to the apiSpec used by built-in models
    if (
      endpointId === 'anthropic' ||
      endpointId === 'openai' ||
      endpointId === 'google'
    ) {
      const { apiKey, baseURL } = this.resolveProviderEndpoint(endpointId);
      const apiSpecMap: Record<ModelProvider, ApiSpec> = {
        anthropic: 'anthropic',
        openai: 'openai-responses',
        google: 'google',
      };
      return { apiKey, baseURL, apiSpec: apiSpecMap[endpointId] };
    }

    // Custom endpoint reference
    const endpoint = this.preferencesService
      .get()
      .customEndpoints.find((ep) => ep.id === endpointId);
    if (!endpoint) throw new Error(`Custom endpoint ${endpointId} not found`);

    return {
      apiKey: this.preferencesService.decryptProviderApiKey(
        endpoint.encryptedApiKey,
      ),
      baseURL: endpoint.baseUrl,
      apiSpec: endpoint.apiSpec,
    };
  }

  /**
   * Check whether a model ID exists (built-in or custom).
   */
  public modelExists(modelId: ModelId): boolean {
    if (availableModels.some((m) => m.modelId === modelId)) return true;
    return this.preferencesService
      .get()
      .customModels.some((m) => m.modelId === modelId);
  }

  /**
   * Get a model usable by AI-SDK alongside provider options and headers that should be sent for auth.
   * The returned model includes tracing using the telemetry service (only active if the preferences are configured accordingly).
   *
   * The model routes to the user configured endpoint based on provider preferences.
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
    try {
      return this.createModelWithOptions(
        modelId,
        traceId,
        otherPostHogProperties,
      );
    } catch (error) {
      this.report(error as Error, 'getModelWithOptions', { modelId });
      throw error;
    }
  }

  private createModelWithOptions(
    modelId: ModelId,
    traceId: string,
    otherPostHogProperties?: Record<string, unknown>,
  ): {
    model: LanguageModelV3;
    providerOptions: Parameters<typeof streamText>[0]['providerOptions'];
    headers: Record<string, string>;
    contextWindowSize: number;
  } {
    // 1. Try built-in models
    const builtIn = availableModels.find((m) => m.modelId === modelId);
    if (builtIn) {
      return this.createBuiltInModelWithOptions(
        builtIn,
        traceId,
        otherPostHogProperties,
      );
    }

    // 2. Try custom models
    const custom = this.preferencesService
      .get()
      .customModels.find((m) => m.modelId === modelId);
    if (custom) {
      return this.createCustomModelWithOptions(
        custom,
        traceId,
        otherPostHogProperties,
      );
    }

    throw new Error(`Model ${modelId} not found`);
  }

  private createBuiltInModelWithOptions(
    modelSettings: (typeof availableModels)[number],
    traceId: string,
    otherPostHogProperties?: Record<string, unknown>,
  ): {
    model: LanguageModelV3;
    providerOptions: Parameters<typeof streamText>[0]['providerOptions'];
    headers: Record<string, string>;
    contextWindowSize: number;
  } {
    const { apiKey, baseURL } = this.resolveProviderEndpoint(
      modelSettings.provider,
    );
    const headers = modelSettings.headers ?? {};

    const posthogConfig = {
      posthogTraceId: traceId,
      posthogProperties: {
        posthogTraceId: traceId,
        modelId: modelSettings.modelId,
        ...otherPostHogProperties,
      },
    };

    switch (modelSettings.provider) {
      case 'anthropic': {
        const anthropicProvider = createAnthropic({ apiKey, baseURL });
        return {
          model: this.telemetryService.withTracing(
            anthropicProvider(modelSettings.modelId),
            posthogConfig,
          ),
          headers,
          providerOptions: {
            anthropic: { ...modelSettings.providerOptions },
          },
          contextWindowSize: modelSettings.modelContextRaw,
        };
      }

      case 'openai': {
        const openaiProvider = createOpenAI({ apiKey, baseURL });
        return {
          model: this.telemetryService.withTracing(
            openaiProvider(modelSettings.modelId),
            posthogConfig,
          ),
          headers,
          providerOptions: { openai: { ...modelSettings.providerOptions } },
          contextWindowSize: modelSettings.modelContextRaw,
        };
      }

      case 'google': {
        const googleProvider = createGoogleGenerativeAI({ apiKey, baseURL });
        return {
          model: this.telemetryService.withTracing(
            googleProvider(modelSettings.modelId),
            posthogConfig,
          ),
          headers,
          providerOptions: { google: { ...modelSettings.providerOptions } },
          contextWindowSize: modelSettings.modelContextRaw,
        };
      }
    }
  }

  private createCustomModelWithOptions(
    customModel: CustomModel,
    traceId: string,
    otherPostHogProperties?: Record<string, unknown>,
  ): {
    model: LanguageModelV3;
    providerOptions: Parameters<typeof streamText>[0]['providerOptions'];
    headers: Record<string, string>;
    contextWindowSize: number;
  } {
    const { apiKey, baseURL, apiSpec } = this.resolveCustomEndpoint(
      customModel.endpointId,
    );
    const headers = customModel.headers ?? {};

    const posthogConfig = {
      posthogTraceId: traceId,
      posthogProperties: {
        posthogTraceId: traceId,
        modelId: customModel.modelId,
        isCustomModel: true,
        ...otherPostHogProperties,
      },
    };

    // Determine the provider options key for the AI SDK
    const providerKey = apiSpec.startsWith('openai-') ? 'openai' : apiSpec;

    // Cast through any to satisfy SharedV3ProviderOptions which expects JSONObject
    const providerOptions =
      Object.keys(customModel.providerOptions).length > 0
        ? ({ [providerKey]: customModel.providerOptions } as any)
        : {};

    switch (apiSpec) {
      case 'anthropic': {
        const provider = createAnthropic({ apiKey, baseURL });
        return {
          model: this.telemetryService.withTracing(
            provider(customModel.modelId as any),
            posthogConfig,
          ),
          headers,
          providerOptions,
          contextWindowSize: customModel.contextWindowSize,
        };
      }

      case 'openai-chat-completions': {
        const provider = createOpenAI({ apiKey, baseURL });
        return {
          model: this.telemetryService.withTracing(
            provider.chat(customModel.modelId as any),
            posthogConfig,
          ),
          headers,
          providerOptions,
          contextWindowSize: customModel.contextWindowSize,
        };
      }

      case 'openai-responses': {
        const provider = createOpenAI({ apiKey, baseURL });
        return {
          model: this.telemetryService.withTracing(
            provider.responses(customModel.modelId as any),
            posthogConfig,
          ),
          headers,
          providerOptions,
          contextWindowSize: customModel.contextWindowSize,
        };
      }

      case 'google': {
        const provider = createGoogleGenerativeAI({ apiKey, baseURL });
        return {
          model: this.telemetryService.withTracing(
            provider(customModel.modelId as any),
            posthogConfig,
          ),
          headers,
          providerOptions,
          contextWindowSize: customModel.contextWindowSize,
        };
      }
    }
  }
}
