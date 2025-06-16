import type { Dependencies } from './types';
import { compareVersions } from './version-comparator';

export function getInstalledDependencies(
  lockFileContent: string,
): Dependencies {
  const dependencies: Dependencies = {};

  const parsedLockFile = parseYarnLock(lockFileContent);

  for (const [key, value] of Object.entries(parsedLockFile)) {
    const name = key;
    const cleanedName = name.match(/^((?:@)?(?:[^@]+))(.*)$/)?.[1];
    const version = value.version;
    if (cleanedName && version) {
      if (
        !dependencies[cleanedName] ||
        compareVersions(dependencies[cleanedName], version) > 0
      ) {
        dependencies[cleanedName] = version;
      }
    }
  }

  return dependencies;
}

function parseYarnLock(fileContent: string): object {
  const lines = fileContent.split(/\r?\n/);
  const result = {};
  let currentPackageData = null;
  let inDependenciesBlock = false;

  for (const line of lines) {
    // Skip empty lines and comments
    if (line.trim() === '' || line.startsWith('#')) {
      continue;
    }

    // A line that is NOT indented indicates a new package entry.
    if (!line.startsWith('  ')) {
      // This is the end of any previous dependency block.
      inDependenciesBlock = false;
      currentPackageData = null;

      // Parse the package specifier(s). A single entry can have multiple,
      // like "pkg-a@^1.0.0, pkg-a@^1.1.0":
      const rawKeys = line.slice(0, -1); // Remove the trailing colon
      const keys = rawKeys
        .split(',')
        .map((key) => key.trim().replace(/"/g, ''));

      // All keys for this entry will point to the same data object.
      const entryData: Record<string, any> = {};
      keys.forEach((key) => {
        (result as Record<string, any>)[key] = entryData;
      });

      // Set this as the current package being populated.
      currentPackageData = entryData;
    }
    // An indented line is a property of the current package.
    else {
      if (!currentPackageData) continue; // Should not happen in a valid file

      const trimmedLine = line.trim();

      if (inDependenciesBlock) {
        // This line is a dependency inside a `dependencies:` block.
        // Format is: "package-name" "version-specifier"
        const depMatch = trimmedLine.match(/^"([^"]+)"\s+(.*)$/);
        if (depMatch) {
          const depName = depMatch[1];
          const depVersion = depMatch[2].replace(/"/g, '').trim();
          currentPackageData.dependencies[depName] = depVersion;
        }
      } else {
        // This is a top-level property of the package entry.
        if (trimmedLine.startsWith('dependencies:')) {
          // The start of a dependencies block.
          inDependenciesBlock = true;
          currentPackageData.dependencies = {};
        } else {
          // A regular property like "version" or "resolved".
          // Format is: key "value" or key value
          const propMatch = trimmedLine.match(/^(\S+)\s+(.*)$/);
          if (propMatch) {
            const key = propMatch[1];
            const value = propMatch[2].replace(/"/g, '').trim();
            currentPackageData[key] = value;
          }
        }
      }
    }
  }
  return result;
}
