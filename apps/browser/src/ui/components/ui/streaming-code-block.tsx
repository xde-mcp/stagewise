'use client';

import { useEffect, useRef, useState, memo } from 'react';
import type {
  BundledLanguage,
  ThemeRegistrationAny,
  ShikiTransformer,
} from 'shiki';
import { cn } from '@ui/utils';
import CodeBlockLightTheme from './code-block-light-theme.json';
import CodeBlockDarkTheme from './code-block-dark-theme.json';
import type { CodeBlockTheme } from './code-block';
import type { Element } from 'hast';

// =============================================================================
// Streaming Highlighter Manager (simplified version for streaming)
// =============================================================================

// Import the highlighter infrastructure from shiki
import { bundledLanguages, createHighlighter } from 'shiki';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

// Default theme using the generated theme files
const defaultStreamingTheme: CodeBlockTheme = {
  light: CodeBlockLightTheme as ThemeRegistrationAny,
  dark: CodeBlockDarkTheme as ThemeRegistrationAny,
};

/**
 * Simplified highlighter manager for streaming code blocks.
 * Does not include diff notation, line numbers, or collapse transformers
 * to keep highlighting fast during streaming.
 */
class StreamingHighlighterManager {
  private lightHighlighter: Awaited<
    ReturnType<typeof createHighlighter>
  > | null = null;
  private darkHighlighter: Awaited<
    ReturnType<typeof createHighlighter>
  > | null = null;
  private readonly loadedLanguages: Set<BundledLanguage> = new Set();
  private initializationPromise: Promise<void> | null = null;
  private themes: [ThemeRegistrationAny, ThemeRegistrationAny];

  constructor(theme: CodeBlockTheme = defaultStreamingTheme) {
    this.themes = [theme.light, theme.dark];
  }

  private isLanguageSupported(language: string): language is BundledLanguage {
    return Object.hasOwn(bundledLanguages, language);
  }

  private async ensureHighlightersInitialized(
    language: BundledLanguage,
  ): Promise<void> {
    const jsEngine = createJavaScriptRegexEngine({ forgiving: true });

    const needsLightRecreation = !this.lightHighlighter;
    const needsDarkRecreation = !this.darkHighlighter;

    if (needsLightRecreation || needsDarkRecreation) {
      this.loadedLanguages.clear();
    }

    const isLanguageSupported = this.isLanguageSupported(language);
    const needsLanguageLoad =
      !this.loadedLanguages.has(language) && isLanguageSupported;

    if (needsLightRecreation) {
      this.lightHighlighter = await createHighlighter({
        themes: [this.themes[0]],
        langs: isLanguageSupported ? [language] : [],
        engine: jsEngine,
      });
      if (isLanguageSupported) {
        this.loadedLanguages.add(language);
      }
    } else if (needsLanguageLoad) {
      await this.lightHighlighter?.loadLanguage(language);
    }

    if (needsDarkRecreation) {
      const langsToLoad = needsLanguageLoad
        ? [...Array.from(this.loadedLanguages)].concat(
            isLanguageSupported ? [language] : [],
          )
        : Array.from(this.loadedLanguages);

      this.darkHighlighter = await createHighlighter({
        themes: [this.themes[1]],
        langs:
          langsToLoad.length > 0
            ? langsToLoad
            : isLanguageSupported
              ? [language]
              : [],
        engine: jsEngine,
      });
    } else if (needsLanguageLoad) {
      await this.darkHighlighter?.loadLanguage(language);
    }

    if (needsLanguageLoad) {
      this.loadedLanguages.add(language);
    }
  }

  async highlightCode(
    code: string,
    language: BundledLanguage,
    preClassName?: string,
  ): Promise<[string, string]> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }

    this.initializationPromise = this.ensureHighlightersInitialized(language);
    await this.initializationPromise;
    this.initializationPromise = null;

    const lang = this.isLanguageSupported(language) ? language : 'text';

    // Use line number transformer for visual consistency with CodeBlock
    const transformers: ShikiTransformer[] = [streamingLineNumbers()];

    const light =
      this.lightHighlighter?.codeToHtml(code, {
        lang,
        theme: this.themes[0],
        transformers,
      }) ?? '';

    const dark =
      this.darkHighlighter?.codeToHtml(code, {
        lang,
        theme: this.themes[1],
        transformers,
      }) ?? '';

    const addPreClass = (html: string) => {
      if (!preClassName) return html;
      const preTagRegex = /<pre(\s|>)/;
      return html.replace(preTagRegex, `<pre class="${preClassName}"$1`);
    };

    const addCodeScroll = (html: string) => {
      // Add overflow-x: auto and scrollbar-subtle to code element so it scrolls
      // Match the styling from CodeBlock for consistency
      return html.replace(/<code([^>]*)>/, (_match, attrs) => {
        const flexStyles =
          'overflow-x: auto; overflow-y: visible; min-width: 0; flex: 1;';
        if (attrs.includes('class=')) {
          const withClass = attrs.replace(
            /class="([^"]*)"/,
            'class="$1 scrollbar-subtle"',
          );
          return `<code${withClass} style="${flexStyles}">`;
        }
        return `<code${attrs} class="scrollbar-subtle" style="${flexStyles}">`;
      });
    };

    return [
      addCodeScroll(addPreClass(light)),
      addCodeScroll(addPreClass(dark)),
    ];
  }
}

/**
 * Simple line number transformer for streaming code blocks.
 * Adds a line-numbers-container div matching CodeBlock's structure.
 */
function streamingLineNumbers(): ShikiTransformer {
  return {
    name: 'streaming-line-numbers',
    pre(node) {
      const codeElement = node.children.find(
        (child) => child.type === 'element' && child.tagName === 'code',
      ) as Element | undefined;

      if (!codeElement) return;

      const lineElements = codeElement.children.filter(
        (child) =>
          child.type === 'element' &&
          child.tagName === 'span' &&
          child.properties?.class &&
          (child.properties.class === 'line' ||
            (Array.isArray(child.properties.class) &&
              child.properties.class.includes('line'))),
      );

      const lineNumberElements: Element[] = lineElements.map((_, index) => ({
        type: 'element',
        tagName: 'span',
        properties: { class: 'line-number' },
        children: [{ type: 'text', value: `${index + 1}` }],
      }));

      node.children.unshift({
        type: 'element',
        tagName: 'div',
        properties: { class: ['line-numbers-container'] },
        children: lineNumberElements,
      });
    },
  };
}

// Singleton manager for streaming highlighting
let streamingHighlighterManager: StreamingHighlighterManager | null = null;

function getStreamingHighlighterManager(): StreamingHighlighterManager {
  if (!streamingHighlighterManager) {
    streamingHighlighterManager = new StreamingHighlighterManager();
  }
  return streamingHighlighterManager;
}

// =============================================================================
// Language Detection Utility
// =============================================================================

/**
 * Extracts the programming language from a file path based on its extension.
 * Falls back to 'text' if the extension is not recognized.
 */
export function getLanguageFromPath(filePath?: string | null): BundledLanguage {
  if (!filePath) return 'text' as BundledLanguage;

  const filename = filePath.replace(/^.*[\\/]/, '');
  const extension = filename?.split('.').pop()?.toLowerCase();

  if (!extension) return 'text' as BundledLanguage;

  // Map common extensions to Shiki language identifiers
  const extensionMap: Record<string, BundledLanguage> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    php: 'php',
    vue: 'vue',
    svelte: 'svelte',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    mdx: 'mdx',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'fish',
    ps1: 'powershell',
    dockerfile: 'dockerfile',
    graphql: 'graphql',
    gql: 'graphql',
    xml: 'xml',
    toml: 'toml',
    ini: 'ini',
    env: 'dotenv',
    prisma: 'prisma',
    astro: 'astro',
  };

  return extensionMap[extension] ?? (extension as BundledLanguage);
}

// =============================================================================
// Streaming Code Block Component
// =============================================================================

interface StreamingCodeBlockProps {
  code: string;
  language: BundledLanguage;
  className?: string;
  preClassName?: string;
}

// Dynamic threshold configuration: scales with code length
const MIN_CHAR_THRESHOLD = 1;
const MAX_CHAR_THRESHOLD = 15;
const CHAR_THRESHOLD_SCALE_FACTOR = 100; // Every 100 chars adds 1 to threshold
// Flush timeout to catch final characters when streaming stops
const FLUSH_TIMEOUT_MS = 50;

/**
 * Computes a dynamic character threshold based on code length.
 * Highlights more frequently when code is short (fast), less frequently when long (slower).
 * - 0-49 chars: threshold = 1
 * - 50-99 chars: threshold = 2
 * - ...
 * - 700+ chars: threshold = 15 (capped)
 */
function getCharThreshold(codeLength: number): number {
  return Math.min(
    MAX_CHAR_THRESHOLD,
    MIN_CHAR_THRESHOLD + Math.floor(codeLength / CHAR_THRESHOLD_SCALE_FACTOR),
  );
}

/**
 * A code block component optimized for streaming content.
 *
 * Features:
 * - Shows plain monospace text immediately (no flash of empty content)
 * - Debounces highlighting by character count to avoid excessive CPU usage
 * - Uses a flush timeout to highlight remaining characters when streaming stops
 * - Uses version tracking to ignore stale highlighting results
 * - Smoothly transitions from plain text to highlighted text
 */
const DEFAULT_PRE_CLASS_NAME =
  'flex flex-row font-mono text-xs w-full select-text';

export const StreamingCodeBlock = memo(
  ({
    code,
    language,
    className,
    preClassName = DEFAULT_PRE_CLASS_NAME,
  }: StreamingCodeBlockProps) => {
    const [lightHtml, setLightHtml] = useState<string>('');
    const [darkHtml, setDarkHtml] = useState<string>('');
    const [hasHighlighted, setHasHighlighted] = useState(false);

    // Version tracking to ignore stale results
    const versionRef = useRef(0);
    // Track the code length at the last highlight
    const lastHighlightedLengthRef = useRef(0);
    // Timeout for flushing remaining characters when streaming stops
    const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    // Compute line numbers for fallback view
    const lineCount = code.split('\n').length;

    useEffect(() => {
      mountedRef.current = true;

      // Increment version on each code change
      versionRef.current += 1;
      const currentVersion = versionRef.current;

      // Clear any pending flush timeout
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }

      const charsSinceLastHighlight =
        code.length - lastHighlightedLengthRef.current;
      const shouldHighlightNow =
        charsSinceLastHighlight >= getCharThreshold(code.length);

      const doHighlight = () => {
        const highlighterManager = getStreamingHighlighterManager();

        highlighterManager
          .highlightCode(code, language, preClassName)
          .then(([light, dark]) => {
            // Only apply if this is still the current version and component is mounted
            if (mountedRef.current && currentVersion === versionRef.current) {
              setLightHtml(light);
              setDarkHtml(dark);
              setHasHighlighted(true);
              lastHighlightedLengthRef.current = code.length;
            }
          });
      };

      if (shouldHighlightNow) {
        // Threshold crossed - highlight immediately
        doHighlight();
      } else {
        // Set a flush timeout to catch remaining characters when streaming stops
        flushTimeoutRef.current = setTimeout(doHighlight, FLUSH_TIMEOUT_MS);
      }

      return () => {
        mountedRef.current = false;
        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current);
        }
      };
    }, [code, language, preClassName]);

    // Show plain text with line numbers until highlighting is ready
    if (!hasHighlighted) {
      return (
        <pre className={cn(preClassName, className)}>
          <div className="line-numbers-container">
            {Array.from({ length: lineCount }, (_, i) => (
              <span key={`ln-${i + 1}`} className="line-number">
                {i + 1}
              </span>
            ))}
          </div>
          <code
            className="scrollbar-subtle"
            style={{
              overflowX: 'auto',
              overflowY: 'visible',
              minWidth: 0,
              flex: 1,
            }}
          >
            {code.split('\n').map((line, i) => (
              <span key={`line-${i + 1}`} className="line">
                {line}
                {i < lineCount - 1 && '\n'}
              </span>
            ))}
          </code>
        </pre>
      );
    }

    // Show highlighted code
    return (
      <>
        <div
          className={cn(
            'group/chat-message-user:hidden dark:hidden [&_code]:text-xs [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:p-0',
            className,
          )}
          dangerouslySetInnerHTML={{ __html: lightHtml }}
        />
        <div
          className={cn(
            'hidden group/chat-message-user:block dark:block [&_code]:text-xs [&_pre]:m-0 [&_pre]:bg-transparent [&_pre]:p-0',
            className,
          )}
          dangerouslySetInnerHTML={{ __html: darkHtml }}
        />
      </>
    );
  },
  (prevProps, nextProps) =>
    prevProps.code === nextProps.code &&
    prevProps.language === nextProps.language &&
    prevProps.className === nextProps.className &&
    prevProps.preClassName === nextProps.preClassName,
);

StreamingCodeBlock.displayName = 'StreamingCodeBlock';
