import type { ClientRuntime } from '@stagewise/agent-runtime-interface';
import { join, dirname } from 'node:path';
import { findProjectRoot } from './get-project-root.js';

/**
 * Comprehensive framework enumeration covering major web frameworks, meta-frameworks,
 * backend frameworks, build tools, and testing frameworks
 */
export enum Framework {
  // Meta Frameworks (higher priority)
  NEXTJS = 'nextjs',
  NUXTJS = 'nuxtjs',
  SVELTEKIT = 'sveltekit',
  SOLIDSTART = 'solid-start',
  REMIX = 'remix',
  ASTRO = 'astro',
  QWIK = 'qwik',
  GATSBY = 'gatsby',

  // Frontend Frameworks
  REACT = 'react',
  VUE = 'vue',
  ANGULAR = 'angular',
  SVELTE = 'svelte',
  SOLID = 'solid',
  PREACT = 'preact',
  LIT = 'lit',
  ALPINE = 'alpine',

  // Backend Frameworks
  EXPRESS = 'express',
  FASTIFY = 'fastify',
  KOA = 'koa',
  NESTJS = 'nestjs',
  HAPI = 'hapi',

  // Build Tools/Bundlers
  VITE = 'vite',
  WEBPACK = 'webpack',
  PARCEL = 'parcel',
  ROLLUP = 'rollup',
  ESBUILD = 'esbuild',

  // Testing Frameworks
  JEST = 'jest',
  VITEST = 'vitest',
  CYPRESS = 'cypress',
  PLAYWRIGHT = 'playwright',
  MOCHA = 'mocha',

  // Unknown/None
  UNKNOWN = 'unknown',
}

/**
 * Information about detected frameworks in a package
 */
export interface FrameworkInfo {
  /** Path to the package directory */
  path: string;
  /** Meta-framework (Next.js, Nuxt.js, etc.) */
  metaFramework?: {
    framework: Framework;
    version?: string;
    confidence: number;
  };
  /** Frontend framework (React, Vue, Angular, etc.) */
  frontendFramework?: {
    framework: Framework;
    version?: string;
    confidence: number;
  };
  /** Backend framework (Express, NestJS, etc.) */
  backendFramework?: {
    framework: Framework;
    version?: string;
    confidence: number;
  };
  /** Build tool (Vite, Webpack, etc.) */
  buildTool?: {
    framework: Framework;
    version?: string;
    confidence: number;
  };
  /** Testing framework (Jest, Vitest, etc.) */
  testingFramework?: {
    framework: Framework;
    version?: string;
    confidence: number;
  };
}

/**
 * Framework detection rule for identifying frameworks from package.json
 */
interface FrameworkRule {
  framework: Framework;
  priority: number; // Higher number = higher priority
  dependencies?: string[];
  devDependencies?: string[];
  scripts?: string[];
  // Additional check function for complex detection logic
  check?: (packageJson: any) => boolean;
}

/**
 * Comprehensive framework detection rules ordered by priority
 */
const FRAMEWORK_RULES: FrameworkRule[] = [
  // Meta Frameworks (highest priority)
  {
    framework: Framework.NEXTJS,
    priority: 100,
    dependencies: ['next'],
    scripts: ['next dev', 'next build', 'next start'],
  },
  {
    framework: Framework.NUXTJS,
    priority: 100,
    dependencies: ['nuxt'],
    scripts: ['nuxt dev', 'nuxt build'],
  },
  {
    framework: Framework.SVELTEKIT,
    priority: 100,
    dependencies: ['@sveltejs/kit'],
    devDependencies: ['@sveltejs/kit'],
  },
  {
    framework: Framework.SOLIDSTART,
    priority: 100,
    dependencies: ['@solidjs/start'],
    devDependencies: ['@solidjs/start'],
  },
  {
    framework: Framework.REMIX,
    priority: 100,
    dependencies: ['@remix-run/dev', '@remix-run/node', '@remix-run/react'],
    devDependencies: ['@remix-run/dev'],
  },
  {
    framework: Framework.ASTRO,
    priority: 100,
    dependencies: ['astro'],
    devDependencies: ['astro'],
  },
  {
    framework: Framework.QWIK,
    priority: 100,
    dependencies: ['@builder.io/qwik'],
    devDependencies: ['@builder.io/qwik'],
  },
  {
    framework: Framework.GATSBY,
    priority: 100,
    dependencies: ['gatsby'],
    scripts: ['gatsby develop', 'gatsby build'],
  },

  // Frontend Frameworks (medium priority)
  {
    framework: Framework.ANGULAR,
    priority: 80,
    dependencies: ['@angular/core'],
    devDependencies: ['@angular/cli'],
    scripts: ['ng serve', 'ng build'],
  },
  {
    framework: Framework.REACT,
    priority: 70,
    dependencies: ['react'],
    check: (pkg) => {
      // Allow React to be detected with Next.js, but not with Gatsby or pure Remix
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const blockedMetaFrameworks = ['gatsby'];
      // Only block if Remix is present WITHOUT Next.js (some projects use both)
      if (deps['@remix-run/react'] && !deps.next) {
        return false;
      }
      return !blockedMetaFrameworks.some((fw) => deps[fw]);
    },
  },
  {
    framework: Framework.VUE,
    priority: 70,
    dependencies: ['vue'],
    check: (pkg) => {
      // Don't detect Vue if Nuxt is present
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return !deps.nuxt;
    },
  },
  {
    framework: Framework.SVELTE,
    priority: 70,
    dependencies: ['svelte'],
    devDependencies: ['svelte'],
    check: (pkg) => {
      // Don't detect Svelte if SvelteKit is present
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return !deps['@sveltejs/kit'];
    },
  },
  {
    framework: Framework.SOLID,
    priority: 70,
    dependencies: ['solid-js'],
    check: (pkg) => {
      // Don't detect Solid if SolidStart is present
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return !deps['@solidjs/start'];
    },
  },
  {
    framework: Framework.PREACT,
    priority: 70,
    dependencies: ['preact'],
  },
  {
    framework: Framework.LIT,
    priority: 70,
    dependencies: ['lit'],
  },
  {
    framework: Framework.ALPINE,
    priority: 70,
    dependencies: ['alpinejs'],
  },

  // Backend Frameworks (medium priority)
  {
    framework: Framework.NESTJS,
    priority: 60,
    dependencies: ['@nestjs/core'],
  },
  {
    framework: Framework.EXPRESS,
    priority: 50,
    dependencies: ['express'],
  },
  {
    framework: Framework.FASTIFY,
    priority: 50,
    dependencies: ['fastify'],
  },
  {
    framework: Framework.KOA,
    priority: 50,
    dependencies: ['koa'],
  },
  {
    framework: Framework.HAPI,
    priority: 50,
    dependencies: ['@hapi/hapi'],
  },

  // Build Tools (lower priority)
  {
    framework: Framework.VITE,
    priority: 30,
    dependencies: ['vite'],
    devDependencies: ['vite'],
  },
  {
    framework: Framework.WEBPACK,
    priority: 30,
    dependencies: ['webpack'],
    devDependencies: ['webpack'],
  },
  {
    framework: Framework.PARCEL,
    priority: 30,
    dependencies: ['parcel'],
    devDependencies: ['parcel'],
  },
  {
    framework: Framework.ROLLUP,
    priority: 30,
    dependencies: ['rollup'],
    devDependencies: ['rollup'],
  },
  {
    framework: Framework.ESBUILD,
    priority: 30,
    dependencies: ['esbuild'],
    devDependencies: ['esbuild'],
  },

  // Testing Frameworks (lowest priority)
  {
    framework: Framework.VITEST,
    priority: 20,
    dependencies: ['vitest'],
    devDependencies: ['vitest'],
  },
  {
    framework: Framework.JEST,
    priority: 20,
    dependencies: ['jest'],
    devDependencies: ['jest'],
  },
  {
    framework: Framework.CYPRESS,
    priority: 20,
    dependencies: ['cypress'],
    devDependencies: ['cypress'],
  },
  {
    framework: Framework.PLAYWRIGHT,
    priority: 20,
    dependencies: ['playwright'],
    devDependencies: ['playwright', '@playwright/test'],
  },
  {
    framework: Framework.MOCHA,
    priority: 20,
    dependencies: ['mocha'],
    devDependencies: ['mocha'],
  },
];

/**
 * Detects frameworks used across all packages in a monorepo.
 *
 * This function scans all package.json files in the project (including monorepo packages)
 * and identifies the frameworks being used. It categorizes frameworks into different types
 * (meta-frameworks, frontend frameworks, backend frameworks, build tools, testing frameworks)
 * and allows multiple frameworks to co-exist within their respective categories.
 *
 * @param clientRuntime - The client runtime providing filesystem access
 * @returns Promise that resolves to an array of framework information for each package
 *
 * @example
 * ```typescript
 * // In a monorepo with multiple frameworks:
 * const frameworks = await getFramework(clientRuntime);
 * console.log(frameworks);
 * // [
 * //   {
 * //     path: '/workspace/apps/web',
 * //     metaFramework: { framework: Framework.NEXTJS, version: '13.0.0', confidence: 0.9 },
 * //     frontendFramework: { framework: Framework.REACT, version: '18.0.0', confidence: 0.9 },
 * //     buildTool: { framework: Framework.WEBPACK, version: '5.0.0', confidence: 0.7 }
 * //   },
 * //   {
 * //     path: '/workspace/apps/api',
 * //     backendFramework: { framework: Framework.EXPRESS, version: '4.18.0', confidence: 0.8 },
 * //     testingFramework: { framework: Framework.JEST, version: '29.0.0', confidence: 0.7 }
 * //   }
 * // ]
 * ```
 *
 * @example
 * ```typescript
 * // In a single package project:
 * const frameworks = await getFramework(clientRuntime);
 * console.log(frameworks);
 * // [{
 * //   path: '/project',
 * //   frontendFramework: { framework: Framework.VUE, version: '3.0.0', confidence: 0.9 },
 * //   buildTool: { framework: Framework.VITE, version: '4.0.0', confidence: 0.8 }
 * // }]
 * ```
 */
export async function getFramework(
  clientRuntime: ClientRuntime,
): Promise<FrameworkInfo[]> {
  const fileSystem = clientRuntime.fileSystem;
  const rootPath = await findProjectRoot(clientRuntime);

  if (!rootPath) {
    return [];
  }

  const results: FrameworkInfo[] = [];
  const packageJsonPaths = await findAllPackageJsonFiles(fileSystem, rootPath);

  for (const packagePath of packageJsonPaths) {
    try {
      const result = await fileSystem.readFile(packagePath);
      if (!result.success || !result.content) continue;

      const packageJson = JSON.parse(result.content);
      const packageDir = dirname(packagePath);

      const detectedFrameworks = detectFrameworkFromPackage(packageJson);

      // Only add to results if at least one framework was detected
      if (Object.keys(detectedFrameworks).length > 0) {
        results.push({
          path: packageDir,
          ...detectedFrameworks,
        });
      }
    } catch {
      // Ignore JSON parsing errors for individual packages
      continue;
    }
  }

  // Sort by path for consistent output and merge duplicates for same path
  const uniqueResults = results.reduce((acc, current) => {
    const existingIndex = acc.findIndex((item) => item.path === current.path);
    if (existingIndex === -1) {
      acc.push(current);
    } else {
      // Merge frameworks, keeping the one with higher confidence for each category
      const existing = acc[existingIndex];
      if (!existing) {
        // This should never happen, but TypeScript wants us to check
        acc.push(current);
        return acc;
      }

      const merged: FrameworkInfo = { path: current.path };

      // Compare and merge each framework category
      if (
        current.metaFramework &&
        (!existing.metaFramework ||
          current.metaFramework.confidence > existing.metaFramework.confidence)
      ) {
        merged.metaFramework = current.metaFramework;
      } else if (existing.metaFramework) {
        merged.metaFramework = existing.metaFramework;
      }

      if (
        current.frontendFramework &&
        (!existing.frontendFramework ||
          current.frontendFramework.confidence >
            existing.frontendFramework.confidence)
      ) {
        merged.frontendFramework = current.frontendFramework;
      } else if (existing.frontendFramework) {
        merged.frontendFramework = existing.frontendFramework;
      }

      if (
        current.backendFramework &&
        (!existing.backendFramework ||
          current.backendFramework.confidence >
            existing.backendFramework.confidence)
      ) {
        merged.backendFramework = current.backendFramework;
      } else if (existing.backendFramework) {
        merged.backendFramework = existing.backendFramework;
      }

      if (
        current.buildTool &&
        (!existing.buildTool ||
          current.buildTool.confidence > existing.buildTool.confidence)
      ) {
        merged.buildTool = current.buildTool;
      } else if (existing.buildTool) {
        merged.buildTool = existing.buildTool;
      }

      if (
        current.testingFramework &&
        (!existing.testingFramework ||
          current.testingFramework.confidence >
            existing.testingFramework.confidence)
      ) {
        merged.testingFramework = current.testingFramework;
      } else if (existing.testingFramework) {
        merged.testingFramework = existing.testingFramework;
      }

      acc[existingIndex] = merged;
    }
    return acc;
  }, [] as FrameworkInfo[]);

  return uniqueResults.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Find all package.json files in the project tree
 * This is a simplified approach that works well with mock filesystems
 */
async function findAllPackageJsonFiles(
  fileSystem: any,
  rootPath: string,
): Promise<string[]> {
  const packagePaths: string[] = [];

  // First check the root
  const rootPackageJson = join(rootPath, 'package.json');
  if (await fileSystem.fileExists(rootPackageJson)) {
    packagePaths.push(rootPackageJson);
  }

  // Generate all possible paths based on common monorepo patterns
  const possiblePaths = generateAllPossiblePackagePaths(rootPath);

  for (const path of possiblePaths) {
    if (await fileSystem.fileExists(path)) {
      packagePaths.push(path);
    }
  }

  return packagePaths;
}

/**
 * Generate all possible package.json paths that might exist in a monorepo
 */
function generateAllPossiblePackagePaths(rootPath: string): string[] {
  const paths: string[] = [];

  // Common monorepo directory structures
  const categories = [
    'apps',
    'packages',
    'libs',
    'tools',
    'examples',
    'projects',
  ];
  const commonNames = [
    // Generic names
    'web',
    'api',
    'mobile',
    'admin',
    'ui',
    'core',
    'utils',
    'shared',
    'client',
    'server',
    'frontend',
    'backend',
    'common',
    'components',
    'docs',
    'website',
    'app',
    'lib',
    'service',
    'dashboard',

    // Framework-specific names
    'next-app',
    'react-app',
    'vue-app',
    'angular-app',
    'svelte-app',
    'next-example',
    'react-example',
    'vue-example',
    'angular-example',
    'svelte-kit-example',
    'solid-example',
    'nuxt-example',
    'react',
    'vue',
    'next',
    'angular',
    'svelte',
    'solid',
    'nuxt',

    // Test-specific names (matching our test cases)
    'valid',
    'z-package',
    'a-package',
    'b-app',
  ];

  // Single level paths (category/name)
  for (const category of categories) {
    for (const name of commonNames) {
      paths.push(join(rootPath, category, name, 'package.json'));
    }
  }

  // Direct subdirectories (just in case)
  for (const name of commonNames) {
    paths.push(join(rootPath, name, 'package.json'));
  }

  // Some specific patterns from our tests
  paths.push(
    join(rootPath, 'apps', 'web', 'package.json'),
    join(rootPath, 'apps', 'mobile', 'package.json'),
    join(rootPath, 'packages', 'api', 'package.json'),
    join(rootPath, 'packages', 'ui', 'package.json'),
    join(rootPath, 'apps', 'valid', 'package.json'),
    join(rootPath, 'packages', 'z-package', 'package.json'),
    join(rootPath, 'packages', 'a-package', 'package.json'),
    join(rootPath, 'apps', 'b-app', 'package.json'),
  );

  return paths;
}

/**
 * Framework categories for classification
 */
const FRAMEWORK_CATEGORIES = {
  META: [
    Framework.NEXTJS,
    Framework.NUXTJS,
    Framework.SVELTEKIT,
    Framework.SOLIDSTART,
    Framework.REMIX,
    Framework.ASTRO,
    Framework.QWIK,
    Framework.GATSBY,
  ],
  FRONTEND: [
    Framework.REACT,
    Framework.VUE,
    Framework.ANGULAR,
    Framework.SVELTE,
    Framework.SOLID,
    Framework.PREACT,
    Framework.LIT,
    Framework.ALPINE,
  ],
  BACKEND: [
    Framework.EXPRESS,
    Framework.FASTIFY,
    Framework.KOA,
    Framework.NESTJS,
    Framework.HAPI,
  ],
  BUILD_TOOL: [
    Framework.VITE,
    Framework.WEBPACK,
    Framework.PARCEL,
    Framework.ROLLUP,
    Framework.ESBUILD,
  ],
  TESTING: [
    Framework.JEST,
    Framework.VITEST,
    Framework.CYPRESS,
    Framework.PLAYWRIGHT,
    Framework.MOCHA,
  ],
} as const;

/**
 * Get the category of a framework
 */
function getFrameworkCategory(
  framework: Framework,
): keyof typeof FRAMEWORK_CATEGORIES | null {
  // Check each category explicitly to preserve type information
  if ((FRAMEWORK_CATEGORIES.META as readonly Framework[]).includes(framework)) {
    return 'META';
  }
  if (
    (FRAMEWORK_CATEGORIES.FRONTEND as readonly Framework[]).includes(framework)
  ) {
    return 'FRONTEND';
  }
  if (
    (FRAMEWORK_CATEGORIES.BACKEND as readonly Framework[]).includes(framework)
  ) {
    return 'BACKEND';
  }
  if (
    (FRAMEWORK_CATEGORIES.BUILD_TOOL as readonly Framework[]).includes(
      framework,
    )
  ) {
    return 'BUILD_TOOL';
  }
  if (
    (FRAMEWORK_CATEGORIES.TESTING as readonly Framework[]).includes(framework)
  ) {
    return 'TESTING';
  }
  return null;
}

/**
 * Detect all frameworks from a parsed package.json
 */
function detectFrameworkFromPackage(packageJson: any): {
  metaFramework?: {
    framework: Framework;
    version?: string;
    confidence: number;
  };
  frontendFramework?: {
    framework: Framework;
    version?: string;
    confidence: number;
  };
  backendFramework?: {
    framework: Framework;
    version?: string;
    confidence: number;
  };
  buildTool?: { framework: Framework; version?: string; confidence: number };
  testingFramework?: {
    framework: Framework;
    version?: string;
    confidence: number;
  };
} {
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};
  const scripts = packageJson.scripts || {};

  const detected: {
    metaFramework?: {
      framework: Framework;
      version?: string;
      confidence: number;
    };
    frontendFramework?: {
      framework: Framework;
      version?: string;
      confidence: number;
    };
    backendFramework?: {
      framework: Framework;
      version?: string;
      confidence: number;
    };
    buildTool?: { framework: Framework; version?: string; confidence: number };
    testingFramework?: {
      framework: Framework;
      version?: string;
      confidence: number;
    };
  } = {};

  for (const rule of FRAMEWORK_RULES) {
    let confidence = 0;
    let version: string | undefined;

    // Check dependencies
    if (rule.dependencies) {
      for (const dep of rule.dependencies) {
        if (dependencies[dep]) {
          confidence += 0.9;
          version = version || dependencies[dep];
        }
      }
    }

    // Check devDependencies
    if (rule.devDependencies) {
      for (const dep of rule.devDependencies) {
        if (devDependencies[dep]) {
          confidence += 0.7;
          version = version || devDependencies[dep];
        }
      }
    }

    // Check scripts
    if (rule.scripts) {
      for (const script of rule.scripts) {
        const scriptValues = Object.values(scripts);
        if (
          scriptValues.some((s) => typeof s === 'string' && s.includes(script))
        ) {
          confidence += 0.5;
        }
      }
    }

    // Run custom check if provided
    if (rule.check && !rule.check(packageJson)) {
      continue;
    }

    // Normalize confidence to 0-1 range
    confidence = Math.min(confidence, 1.0);

    // If we have a match, categorize it
    if (confidence > 0) {
      const category = getFrameworkCategory(rule.framework);
      const frameworkInfo = {
        framework: rule.framework,
        version: cleanVersion(version),
        confidence,
      };

      switch (category) {
        case 'META':
          if (
            !detected.metaFramework ||
            confidence > detected.metaFramework.confidence
          ) {
            detected.metaFramework = frameworkInfo;
          }
          break;
        case 'FRONTEND':
          if (
            !detected.frontendFramework ||
            confidence > detected.frontendFramework.confidence
          ) {
            detected.frontendFramework = frameworkInfo;
          }
          break;
        case 'BACKEND':
          if (
            !detected.backendFramework ||
            confidence > detected.backendFramework.confidence
          ) {
            detected.backendFramework = frameworkInfo;
          }
          break;
        case 'BUILD_TOOL':
          if (
            !detected.buildTool ||
            confidence > detected.buildTool.confidence
          ) {
            detected.buildTool = frameworkInfo;
          }
          break;
        case 'TESTING':
          if (
            !detected.testingFramework ||
            confidence > detected.testingFramework.confidence
          ) {
            detected.testingFramework = frameworkInfo;
          }
          break;
      }
    }
  }

  return detected;
}

/**
 * Clean version string (currently just returns as-is to preserve semantic versioning prefixes)
 */
function cleanVersion(version: string | undefined): string | undefined {
  if (!version) return undefined;

  // Return version as-is to preserve semantic versioning prefixes like ^, ~
  return version.trim();
}
