/**
 * Common utility functions to reduce code duplication
 */

import type { ClientRuntime } from '@stagewise/agent-runtime-interface';

/**
 * Common file extensions for different component types
 */
export const COMPONENT_EXTENSIONS = {
  react: ['.tsx', '.jsx', '.ts', '.js'],
  vue: ['.vue', '.ts', '.js'],
  angular: ['.ts', '.component.ts', '.html'],
  svelte: ['.svelte', '.ts', '.js'],
  solid: ['.tsx', '.jsx', '.ts', '.js'],
};

/**
 * Common test file patterns to exclude
 */
export const TEST_FILE_PATTERNS = [
  '.test.',
  '.spec.',
  '.stories.',
  '__tests__',
  '__mocks__',
  '.e2e.',
  '.integration.',
];

/**
 * Checks if a file is a test file
 */
export function isTestFile(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return TEST_FILE_PATTERNS.some((pattern) => lowerPath.includes(pattern));
}

/**
 * Checks if src directory exists, returns appropriate search path
 */
export async function getSearchPath(
  clientRuntime: ClientRuntime,
  cwd: string,
  preferredPath = 'src',
): Promise<string> {
  const srcPath = clientRuntime.fileSystem.joinPaths(cwd, preferredPath);
  const absolutePath = clientRuntime.fileSystem.resolvePath(srcPath);

  return (await clientRuntime.fileSystem.fileExists(absolutePath))
    ? absolutePath
    : cwd;
}

/**
 * Common directory patterns for different architectures
 */
export const ARCHITECTURE_DIRS = {
  atomic: ['atoms', 'molecules', 'organisms', 'templates', 'pages'],
  traditional: ['components', 'pages', 'layouts', 'hooks', 'utils'],
  feature: ['features', 'modules'],
  domain: ['domain', 'modules', 'features'],
};

/**
 * State management library patterns
 */
export const STATE_LIBRARIES = {
  redux: ['redux', '@reduxjs/toolkit'],
  mobx: ['mobx'],
  zustand: ['zustand'],
  valtio: ['valtio'],
  jotai: ['jotai'],
  recoil: ['recoil'],
  vue: ['vuex', 'pinia'],
};

/**
 * CSS framework patterns
 */
export const CSS_FRAMEWORKS = {
  tailwind: ['tailwindcss'],
  cssInJs: ['styled-components', '@emotion/react', '@emotion/styled'],
  uiLibraries: ['@mui/material', 'antd', '@chakra-ui/react'],
  preprocessors: ['sass', 'node-sass', 'less', 'postcss'],
};

/**
 * Filters an array to unique values
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Safely gets the file name from a path
 */
export function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

/**
 * Checks if a package exists in dependencies
 */
export function hasPackage(
  dependencies: Record<string, any>,
  packageNames: string | string[],
): boolean {
  const packages = Array.isArray(packageNames) ? packageNames : [packageNames];
  return packages.some((pkg) => pkg in dependencies);
}
