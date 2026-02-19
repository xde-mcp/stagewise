import type { ModelSettings } from '@shared/karton-contracts/ui/shared-types';

const anthropicHeaders = {
  'anthropic-beta':
    'fine-grained-tool-streaming-2025-05-14, interleaved-thinking-2025-05-14',
};

const openaiHeaders = {};

const googleHeaders = {};

// TODO: ADD MODEL CAPABILITIES GLENN!!!!!

export const availableModels = [
  // Anthropic Models
  {
    modelId: 'claude-opus-4-6',
    providerOptions: { thinking: { type: 'enabled', budgetTokens: 10000 } },
    modelDisplayName: 'Opus 4.6',
    modelDescription:
      "Anthropic's most capable model, excels at complex reasoning and architectural decisions.",
    modelContext: '200k context',
    modelContextRaw: 200000,
    capabilities: {
      inputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },

      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
    headers: anthropicHeaders,
    thinkingEnabled: true,
  },
  {
    modelId: 'claude-opus-4-5',
    providerOptions: { thinking: { type: 'enabled', budgetTokens: 10000 } },
    modelDisplayName: 'Opus 4.5',
    modelDescription:
      "Anthropic's previous flagship model, excels at complex reasoning and architectural decisions.",
    modelContext: '200k context',
    modelContextRaw: 200000,
    capabilities: {
      inputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },

      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
    headers: anthropicHeaders,
    thinkingEnabled: true,
  },
  {
    modelId: 'gpt-5.2',
    providerOptions: {
      reasoningEffort: 'high',
      reasoningSummary: 'auto',
      parallelToolCalls: true,
      strictJsonSchema: true,
    },
    modelDisplayName: 'GPT-5.2',
    modelDescription:
      "OpenAI's latest flagship model with advanced reasoning for complex coding tasks.",
    modelContext: '128k context',
    modelContextRaw: 128000,
    headers: openaiHeaders,
    thinkingEnabled: true,
    capabilities: {
      inputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },

      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
  },
  {
    modelId: 'gemini-3-pro-preview',
    providerOptions: {
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel: 'high',
      },
    },
    headers: googleHeaders,
    modelDisplayName: 'Gemini 3 Pro',
    modelDescription:
      "Google's advanced model with strong reasoning and multimodal capabilities.",
    modelContext: '1M context',
    modelContextRaw: 1000000,
    thinkingEnabled: true,
    capabilities: {
      inputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },

      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
  },
  {
    modelId: 'claude-haiku-4-5',
    providerOptions: { thinking: { type: 'enabled', budgetTokens: 10000 } },
    modelDisplayName: 'Haiku 4.5',
    modelDescription:
      'Fast and cost-effective, ideal for quick iterations and simple edits.',
    modelContext: '200k context',
    modelContextRaw: 200000,
    headers: anthropicHeaders,
    thinkingEnabled: true,
    capabilities: {
      inputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },

      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
  },
  {
    modelId: 'gpt-5.2-codex',
    providerOptions: {
      reasoningEffort: 'high',
      reasoningSummary: 'auto',
      parallelToolCalls: true,
      strictJsonSchema: true,
    },
    modelDisplayName: 'GPT-5.2 Codex',
    modelDescription:
      "OpenAI's most powerful coding model, designed for large-scale projects and complex refactoring.",
    modelContext: '128k context',
    modelContextRaw: 128000,
    headers: openaiHeaders,
    thinkingEnabled: true,
    capabilities: {
      inputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },

      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
  },
  {
    modelId: 'gpt-5.1-codex-max',
    providerOptions: {
      reasoningEffort: 'high',
      reasoningSummary: 'auto',
      parallelToolCalls: true,
      strictJsonSchema: true,
    },
    modelDisplayName: 'GPT-5.1 Codex Max',
    modelDescription:
      "OpenAI's previous most powerful coding model, designed for large-scale projects and complex refactoring.",
    modelContext: '128k context',
    modelContextRaw: 128000,
    headers: openaiHeaders,
    thinkingEnabled: true,
    capabilities: {
      inputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },

      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
  },
  {
    modelId: 'claude-sonnet-4-6',
    providerOptions: { thinking: { type: 'enabled', budgetTokens: 10000 } },
    modelDisplayName: 'Sonnet 4.6',
    modelDescription:
      "Anthropic's balanced model, great for daily coding tasks.",
    modelContext: '200k context',
    modelContextRaw: 200000,
    headers: anthropicHeaders,
    thinkingEnabled: true,
    capabilities: {
      inputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },

      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
  },
  {
    modelId: 'claude-sonnet-4-5',
    providerOptions: { thinking: { type: 'enabled', budgetTokens: 10000 } },
    modelDisplayName: 'Sonnet 4.5',
    modelDescription:
      "Anthropic's deprecated balanced model, great for daily coding tasks.",
    modelContext: '200k context',
    modelContextRaw: 200000,
    headers: anthropicHeaders,
    thinkingEnabled: true,
    capabilities: {
      inputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },

      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
  },
] as const satisfies ModelSettings[];

export type ModelId = (typeof availableModels)[number]['modelId'];
