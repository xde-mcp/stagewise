export { findProjectRoot, getProjectRoot } from './utils/get-project-root.js';
export { detectMonorepoInfo } from './utils/detect-monorepo.js';
export { getPackageManager } from './utils/get-package-manager.js';
export { getFramework } from './utils/get-framework.js';

export type {
  MonorepoTool,
  MonorepoInfo,
  DetectedTool,
  WorkspacePackage,
} from './utils/detect-monorepo.js';
export type {
  PackageManager,
  PackageManagerInfo,
} from './utils/get-package-manager.js';
export type { Framework, FrameworkInfo } from './utils/get-framework.js';
