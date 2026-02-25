import type { ModelSettings } from '@shared/karton-contracts/ui/shared-types';

const anthropicHeaders = {
  'anthropic-beta':
    'fine-grained-tool-streaming-2025-05-14, interleaved-thinking-2025-05-14',
};

const openaiHeaders = {};

const googleHeaders = {};

import type { ModalityConstraint } from '@shared/karton-contracts/ui/shared-types';

type InputConstraints = {
  image?: ModalityConstraint;
  file?: ModalityConstraint;
  video?: ModalityConstraint;
  audio?: ModalityConstraint;
};

const ANTHROPIC_INPUT_CONSTRAINTS: InputConstraints = {
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxBytes: 5_242_880, // 5 MB per image
  },
  file: {
    mimeTypes: ['application/pdf'],
    maxBytes: 32_000_000, // 32 MB request limit
  },
};

const OPENAI_INPUT_CONSTRAINTS: InputConstraints = {
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxBytes: 20_971_520, // 20 MB
  },
  file: {
    mimeTypes: ['application/pdf'],
    maxBytes: 20_971_520, // 20 MB
  },
};

const GOOGLE_INPUT_CONSTRAINTS: InputConstraints = {
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxBytes: 104_857_600, // 100 MB inline
  },
  file: {
    mimeTypes: ['application/pdf'],
    maxBytes: 104_857_600, // 100 MB inline
  },
  video: {
    mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    maxBytes: 104_857_600, // 100 MB inline
  },
};

export const availableModels = [
  // Anthropic Models
  {
    provider: 'anthropic',
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
        image: true,
        video: false,
        file: true,
      },
      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      inputConstraints: ANTHROPIC_INPUT_CONSTRAINTS,
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
    provider: 'anthropic',
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
        image: true,
        video: false,
        file: true,
      },
      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      inputConstraints: ANTHROPIC_INPUT_CONSTRAINTS,
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
    provider: 'openai',
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
        image: true,
        video: false,
        file: true,
      },
      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      inputConstraints: OPENAI_INPUT_CONSTRAINTS,
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
  },
  {
    provider: 'google',
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
        image: true,
        video: true,
        file: true,
      },
      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      inputConstraints: GOOGLE_INPUT_CONSTRAINTS,
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
  },
  {
    provider: 'anthropic',
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
        image: true,
        video: false,
        file: true,
      },
      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      inputConstraints: ANTHROPIC_INPUT_CONSTRAINTS,
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
  },
  {
    provider: 'openai',
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
        image: true,
        video: false,
        file: true,
      },
      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      inputConstraints: OPENAI_INPUT_CONSTRAINTS,
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
  },
  {
    provider: 'openai',
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
        image: true,
        video: false,
        file: true,
      },
      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      inputConstraints: OPENAI_INPUT_CONSTRAINTS,
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
  },
  {
    provider: 'anthropic',
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
        image: true,
        video: false,
        file: true,
      },
      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      inputConstraints: ANTHROPIC_INPUT_CONSTRAINTS,
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
  },
  {
    provider: 'anthropic',
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
        image: true,
        video: false,
        file: true,
      },
      outputModalities: {
        text: true,
        audio: false,
        image: false,
        video: false,
        file: false,
      },
      inputConstraints: ANTHROPIC_INPUT_CONSTRAINTS,
      toolCalling: true,
      intelligence: {
        canPlan: true,
        canCode: true,
      },
    },
  },
] as const satisfies ModelSettings[];

export type BuiltInModelId = (typeof availableModels)[number]['modelId'];
export type ModelId = BuiltInModelId | (string & {});

/**
 * Look up a model's capabilities by ID.
 * Falls back to text-only when the model is unknown (e.g. custom model
 * without capabilities defined).
 */
export function getModelCapabilities(
  modelId: ModelId,
): ModelSettings['capabilities'] {
  const model = availableModels.find((m) => m.modelId === modelId);
  if (model) return model.capabilities;

  return {
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
    inputConstraints: undefined,
    toolCalling: true,
    intelligence: {
      canPlan: true,
      canCode: true,
    },
  };
}

/**
 * Find model IDs that accept a given MIME type as inline input,
 * optionally excluding one model (typically the current one).
 */
export function findModelsAcceptingMime(
  mime: string,
  excludeModelId?: string,
): string[] {
  const lowerMime = mime.toLowerCase();
  return availableModels
    .filter((m) => {
      if (m.modelId === excludeModelId) return false;
      const c = m.capabilities.inputConstraints;
      if (!c) return false;
      for (const constraint of [c.image, c.file, c.video, c.audio])
        if (constraint?.mimeTypes.includes(lowerMime)) return true;

      return false;
    })
    .map((m) => m.modelId);
}
