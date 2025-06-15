import type { Dependencies } from './types';
import { compareVersions } from './version-comparator';
import yaml from 'js-yaml';

/**
 * Parses a pnpm-lock.yaml file and returns a flat map of dependency name to version.
 * Handles both standalone and monorepo (workspace) pnpm setups.
 */
export function getInstalledDependencies(
  lockFileContent: string,
): Dependencies {
  const data = yaml.load(lockFileContent) as any;
  const dependencies: Dependencies = {};

  if (!data || typeof data !== 'object') {
    return dependencies;
  }

  // 1. Collect all package versions from the 'packages' section
  //    The key is like '/package-name/1.2.3' or '/@scope/name/1.2.3'
  if (data.packages) {
    for (const [pkgPath, pkgData] of Object.entries<any>(data.packages)) {
      // Extract the package name and version from the path
      // e.g. '/react/18.2.0' => name: 'react', version: '18.2.0'
      const match = pkgPath.match(/^\/((?:@[^/]+\/)?[^/]+)\/(.+)$/);
      if (!match) continue;
      const name = match[1];
      let version = match[2];
      if (version.includes('_')) {
        // If version contains an underscore, strip everything after the first underscore
        version = version.split('_')[0];
      }
      if (
        !dependencies[name] ||
        compareVersions(dependencies[name], version) > 0
      ) {
        dependencies[name] = version;
      }
    }
  }

  // 2. For monorepos, also check the 'importers' section for direct dependencies
  //    (importers keys are usually '.' for root, or 'packages/pkgname' for workspaces)
  if (data.importers) {
    for (const importer of Object.values<any>(data.importers)) {
      for (const depType of [
        'dependencies',
        'devDependencies',
        'optionalDependencies',
      ]) {
        if (importer[depType]) {
          for (const [name, versionRange] of Object.entries<string>(
            importer[depType],
          )) {
            // If the dependency is not in the flat map, try to find the lowest version from packages
            if (!dependencies[name]) {
              // Try to find a matching version in packages
              if (data.packages) {
                for (const [pkgPath, pkgData] of Object.entries<any>(
                  data.packages,
                )) {
                  const match = pkgPath.match(/^\/((?:@[^/]+\/)?[^/]+)\/(.+)$/);
                  if (!match) continue;
                  const pkgName = match[1];
                  let pkgVersion = match[2];
                  if (pkgVersion.includes('_')) {
                    pkgVersion = pkgVersion.split('_')[0];
                  }
                  if (pkgName === name) {
                    if (
                      !dependencies[name] ||
                      compareVersions(dependencies[name], pkgVersion) > 0
                    ) {
                      dependencies[name] = pkgVersion;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return dependencies;
}
