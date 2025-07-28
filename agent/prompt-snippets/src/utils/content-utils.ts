/**
 * Utility functions for managing content size and truncation
 */

import type { ClientRuntime } from '@stagewise/agent-runtime-interface';

/**
 * Checks if a file is within the size limit before reading
 * @param clientRuntime The client runtime instance
 * @param filePath The file path to check
 * @param maxSize Maximum allowed file size in bytes
 * @returns true if file is within limit or size cannot be determined
 */
export async function isFileSizeWithinLimit(
  clientRuntime: ClientRuntime,
  filePath: string,
  maxSize: number,
): Promise<boolean> {
  try {
    // Check if getFileStats is available
    if (clientRuntime.fileSystem.getFileStats) {
      const stats = await clientRuntime.fileSystem.getFileStats(filePath);
      if (stats?.size) {
        return stats.size <= maxSize;
      }
    }
    // If we can't determine size, allow the file to be read
    return true;
  } catch {
    // If error checking size, allow the file to be read
    return true;
  }
}

export interface TruncateOptions {
  /**
   * Maximum length of the content
   * @default 10000
   */
  maxLength?: number;
  /**
   * Text to append when content is truncated
   * @default '\n... (truncated)'
   */
  truncationIndicator?: string;
  /**
   * Whether to truncate at word boundaries
   * @default true
   */
  wordBoundary?: boolean;
}

/**
 * Truncates content to a specified maximum length
 * @param content The content to truncate
 * @param options Truncation options
 * @returns The truncated content with indicator if truncated
 */
export function truncateContent(
  content: string,
  options: TruncateOptions = {},
): string {
  const {
    maxLength = 10000,
    truncationIndicator = '\n... (truncated)',
    wordBoundary = true,
  } = options;

  if (content.length <= maxLength) {
    return content;
  }

  let truncateAt = maxLength - truncationIndicator.length;

  if (wordBoundary && truncateAt > 0) {
    // Find the last space, newline, or punctuation before the limit
    const lastSpace = content.lastIndexOf(' ', truncateAt);
    const lastNewline = content.lastIndexOf('\n', truncateAt);
    const lastPunctuation = Math.max(
      content.lastIndexOf('.', truncateAt),
      content.lastIndexOf(',', truncateAt),
      content.lastIndexOf(';', truncateAt),
      content.lastIndexOf(':', truncateAt),
    );

    truncateAt = Math.max(lastSpace, lastNewline, lastPunctuation);

    // If no good break point found, truncate at the limit
    if (truncateAt <= 0) {
      truncateAt = maxLength - truncationIndicator.length;
    }
  }

  return content.substring(0, truncateAt) + truncationIndicator;
}

/**
 * Tracks content size during incremental building
 */
export class ContentBuilder {
  private content: string[] = [];
  private currentLength = 0;
  private truncated = false;

  constructor(private readonly maxLength: number = 10000) {}

  /**
   * Adds content if it fits within the limit
   * @returns true if content was added, false if it would exceed limit
   */
  add(text: string): boolean {
    if (this.truncated) return false;

    if (this.currentLength + text.length > this.maxLength) {
      // Try to add partial content
      const remaining = this.maxLength - this.currentLength;
      if (remaining > 100) {
        // Only add if we have reasonable space
        this.content.push(text.substring(0, remaining));
        this.content.push('\n... (content truncated)');
      } else {
        this.content.push('\n... (content truncated)');
      }
      this.truncated = true;
      return false;
    }

    this.content.push(text);
    this.currentLength += text.length;
    return true;
  }

  /**
   * Gets the built content
   */
  toString(): string {
    return this.content.join('');
  }

  /**
   * Whether the content has been truncated
   */
  isTruncated(): boolean {
    return this.truncated;
  }

  /**
   * Gets the current length
   */
  getLength(): number {
    return this.currentLength;
  }
}
