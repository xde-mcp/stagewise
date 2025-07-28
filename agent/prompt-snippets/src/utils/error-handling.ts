import type { PromptSnippet } from '@stagewise/agent-types';

/**
 * Error types for client utils
 */
export enum ErrorType {
  FileSystem = 'FileSystem',
  Parse = 'Parse',
  Config = 'Config',
  Unknown = 'Unknown',
}

/**
 * Custom error class for client utils
 */
export class ClientUtilsError extends Error {
  constructor(
    message: string,
    public readonly type: ErrorType,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ClientUtilsError';
  }
}

/**
 * Creates an error prompt snippet
 */
export function createErrorSnippet(
  type: string,
  description: string,
  error: unknown,
): PromptSnippet {
  let errorMessage: string;
  let errorType = ErrorType.Unknown;

  if (error instanceof ClientUtilsError) {
    errorMessage = error.message;
    errorType = error.type;
  } else if (error instanceof Error) {
    errorMessage = error.message;
    // Try to determine error type from message
    if (error.message.includes('ENOENT') || error.message.includes('file')) {
      errorType = ErrorType.FileSystem;
    } else if (
      error.message.includes('JSON') ||
      error.message.includes('parse')
    ) {
      errorType = ErrorType.Parse;
    }
  } else {
    errorMessage = String(error);
  }

  return {
    type,
    description,
    content: `Error (${errorType}): ${errorMessage}`,
  };
}

/**
 * Safely parses JSON with better error handling
 */
export function safeJsonParse<T = any>(
  content: string,
  defaultValue?: T,
): { success: true; data: T } | { success: false; error: Error } {
  try {
    const data = JSON.parse(content);
    return { success: true, data };
  } catch (error) {
    if (defaultValue !== undefined) {
      return { success: true, data: defaultValue };
    }
    return {
      success: false,
      error: new ClientUtilsError(
        `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorType.Parse,
        error,
      ),
    };
  }
}

/**
 * Wraps an async operation with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorType: ErrorType,
  errorMessage: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw new ClientUtilsError(errorMessage, errorType, error);
  }
}

/**
 * Logs an error with context (can be extended to use proper logging)
 */
export function logError(context: string, error: unknown): void {
  // For now, just use console.error
  // In the future, this could be extended to use a proper logging system
  if (error instanceof ClientUtilsError) {
    console.error(`[${context}] ${error.type}: ${error.message}`);
    if (error.cause) {
      console.error('Caused by:', error.cause);
    }
  } else if (error instanceof Error) {
    console.error(`[${context}] Error: ${error.message}`);
  } else {
    console.error(`[${context}] Unknown error:`, error);
  }
}
