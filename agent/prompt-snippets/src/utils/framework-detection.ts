import type { ClientRuntime } from '@stagewise/agent-runtime-interface';
import { logError, safeJsonParse } from './error-handling.js';

export type Framework =
  | 'Next.js'
  | 'Nuxt.js'
  | 'Angular'
  | 'Vue'
  | 'React'
  | 'Svelte'
  | 'SolidJS'
  | 'Unknown';

/**
 * Detects the UI framework used in a project
 * @param clientRuntime The client runtime instance
 * @param cwd The current working directory
 * @returns The detected framework name
 */
export async function detectFramework(
  clientRuntime: ClientRuntime,
  cwd: string,
): Promise<Framework> {
  try {
    // First check package.json for the most accurate detection
    const packageJsonPath = clientRuntime.fileSystem.joinPaths(
      cwd,
      'package.json',
    );
    const packageJsonResult =
      await clientRuntime.fileSystem.readFile(packageJsonPath);

    if (packageJsonResult.success && packageJsonResult.content) {
      const parseResult = safeJsonParse(packageJsonResult.content);
      if (!parseResult.success) {
        logError('detectFramework.parsePackageJson', parseResult.error);
        throw parseResult.error;
      }
      const packageJson = parseResult.data;
      const deps = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
      };

      // Check frameworks in priority order
      if (deps.next) return 'Next.js';
      if (deps.nuxt || deps['@nuxt/core']) return 'Nuxt.js';
      if (deps['@angular/core']) return 'Angular';
      if (deps.vue) return 'Vue';
      if (deps.svelte) return 'Svelte';
      if (deps.solid || deps['solid-js']) return 'SolidJS';
      if (deps.react) return 'React';
    }
  } catch (error) {
    logError('detectFramework', error);
    // Continue with file-based detection
  }

  // File-based detection as fallback
  const frameworkFiles: Record<Framework, string[]> = {
    'Next.js': ['next.config.js', 'next.config.ts', 'next.config.mjs'],
    'Nuxt.js': ['nuxt.config.js', 'nuxt.config.ts'],
    Angular: ['angular.json'],
    Vue: ['vue.config.js'],
    Svelte: ['svelte.config.js'],
    SolidJS: ['vite.config.js'], // SolidJS often uses Vite
    React: ['jsconfig.json', 'tsconfig.json'], // Generic React indicators
    Unknown: [],
  };

  for (const [framework, files] of Object.entries(frameworkFiles)) {
    if (framework === 'Unknown') continue;

    for (const file of files) {
      const filePath = clientRuntime.fileSystem.joinPaths(cwd, file);
      if (await clientRuntime.fileSystem.fileExists(filePath)) {
        // Additional validation for generic files
        if (framework === 'SolidJS' && file === 'vite.config.js') {
          try {
            const configResult =
              await clientRuntime.fileSystem.readFile(filePath);
            if (
              configResult.success &&
              configResult.content?.includes('solid')
            ) {
              return framework as Framework;
            }
          } catch (error) {
            logError('detectFramework.viteConfig', error);
            continue;
          }
        } else {
          return framework as Framework;
        }
      }
    }
  }

  // Default to React as it's the most common
  return 'React';
}

/**
 * Gets file extensions commonly used by the framework
 */
export function getFrameworkExtensions(framework: Framework): string[] {
  const extensionMap: Record<Framework, string[]> = {
    'Next.js': ['.tsx', '.ts', '.jsx', '.js'],
    'Nuxt.js': ['.vue', '.ts', '.js'],
    Angular: ['.ts', '.component.ts', '.html'],
    Vue: ['.vue', '.ts', '.js'],
    React: ['.tsx', '.jsx', '.ts', '.js'],
    Svelte: ['.svelte', '.ts', '.js'],
    SolidJS: ['.tsx', '.jsx', '.ts', '.js'],
    Unknown: ['.tsx', '.jsx', '.ts', '.js', '.vue'],
  };

  return extensionMap[framework] || extensionMap.Unknown;
}

/**
 * Detects the architecture pattern used in the project
 */
export async function detectArchitecturePattern(
  clientRuntime: ClientRuntime,
  cwd: string,
): Promise<{ pattern: string; confidence: number; indicators: string[] }> {
  const indicators: string[] = [];
  let pattern = 'traditional';
  let confidence = 0;

  // Check for atomic design
  const atomicDirs = ['atoms', 'molecules', 'organisms', 'templates', 'pages'];
  let atomicCount = 0;
  for (const dir of atomicDirs) {
    if (
      await clientRuntime.fileSystem.fileExists(
        clientRuntime.fileSystem.joinPaths(cwd, 'src/components', dir),
      )
    ) {
      atomicCount++;
      indicators.push(`Found ${dir} folder`);
    }
  }
  if (atomicCount >= 3) {
    pattern = 'atomic';
    confidence = atomicCount / atomicDirs.length;
  }

  // Check for feature-based
  const srcPath = clientRuntime.fileSystem.joinPaths(cwd, 'src');
  if (await clientRuntime.fileSystem.fileExists(srcPath)) {
    const srcList = await clientRuntime.fileSystem.listDirectory(srcPath, {
      includeDirectories: true,
      includeFiles: false,
      maxDepth: 1,
    });

    if (srcList.success && srcList.files) {
      const featureDirs = srcList.files.filter(
        (f) =>
          f.type === 'directory' &&
          ![
            'components',
            'pages',
            'utils',
            'hooks',
            'styles',
            'assets',
            'types',
            'lib',
            'api',
            'config',
          ].includes(f.name),
      );

      if (featureDirs.length >= 3) {
        pattern = 'feature-based';
        confidence = 0.8;
        indicators.push('Feature folders detected');
      }
    }
  }

  // Check for domain-driven
  const domainDirs = ['domain', 'modules', 'features'];
  for (const dir of domainDirs) {
    if (
      await clientRuntime.fileSystem.fileExists(
        clientRuntime.fileSystem.joinPaths(cwd, 'src', dir),
      )
    ) {
      pattern = 'domain-driven';
      confidence = 0.7;
      indicators.push(`Found ${dir} folder`);
      break;
    }
  }

  return { pattern, confidence: confidence || 0.5, indicators };
}
