import { extractDetailsFromError } from './extract-details-from-error.js';

// extracted from the error response in the llm proxy
export type PlanLimitsExceededError = {
  data: {
    code: 'PLAN_LIMIT_EXCEEDED';
    message?: string;
    tokensUsed?: number;
    maxTokens?: number;
    windowMinutes?: number;
    cooldownMinutes?: number;
    isPaidPlan?: boolean;
  };
};

export function isPlanLimitsExceededError(
  error: unknown,
): PlanLimitsExceededError | false {
  // Check for TRPC error with RATE_LIMIT_EXCEEDED code
  const errorDetails = extractDetailsFromError(error);
  if (errorDetails?.code === 'PLAN_LIMIT_EXCEEDED') {
    return {
      data: {
        code: 'PLAN_LIMIT_EXCEEDED',
        message: errorDetails.message || 'Plan limits exceeded',
        tokensUsed: errorDetails.tokensUsed || 0,
        maxTokens: errorDetails.maxTokens || 0,
        windowMinutes: errorDetails.windowMinutes || 0,
        cooldownMinutes: errorDetails.cooldownMinutes || 0,
        isPaidPlan: errorDetails.isPaidPlan || false,
      },
    };
  }
  return false;
}
