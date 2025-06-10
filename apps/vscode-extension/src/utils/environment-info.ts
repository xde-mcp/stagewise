import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import axios from 'axios';

export class EnvironmentInfo {
  private static instance: EnvironmentInfo;
  private static initializationPromise: Promise<void> | null = null;
  private toolbarInstalled = false;
  private toolbarInstalledVersion: string | null = null;
  private latestToolbarVersion: string | null = null;
  private latestExtensionVersion: string | null = null;
  private workspaceLoaded = false;
  private toolbarInstallations: Array<{ version: string; path: string }> = [];
  private static readonly WORKSPACE_VERSION = 'dev';
  private static readonly DEFAULT_VERSION = '0.0.0';

  private constructor() {
    // Set up workspace change listeners
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.checkToolbarInstallation().catch((error) => {
        console.error('Error checking toolbar installation:', error);
      });
    });
  }

  public static async getInstance(): Promise<EnvironmentInfo> {
    try {
      if (!EnvironmentInfo.instance) {
        EnvironmentInfo.instance = new EnvironmentInfo();
        EnvironmentInfo.initializationPromise =
          EnvironmentInfo.instance.initialize();
      }

      // Wait for initialization to complete before returning the instance
      await EnvironmentInfo.initializationPromise;
      return EnvironmentInfo.instance;
    } catch (error) {
      console.error('Error getting EnvironmentInfo instance:', error);
      // Return a new instance even if initialization failed
      return EnvironmentInfo.instance || new EnvironmentInfo();
    }
  }

  private async initialize() {
    try {
      await this.checkToolbarInstallation();
      await this.fetchLatestToolbarVersion();
      await this.fetchLatestExtensionVersion();
    } catch (error) {
      console.error('Error initializing EnvironmentInfo:', error);
    }
  }

  public getExtensionVersion(): string {
    try {
      const extension = vscode.extensions.getExtension(
        'stagewise.stagewise-vscode-extension',
      );
      if (!extension) {
        console.warn('Stagewise extension not found');
        return 'unknown';
      }

      const version = extension.packageJSON?.version;
      if (!version) {
        console.warn('Extension version not found in package.json');
        return 'unknown';
      }

      return version;
    } catch (error) {
      console.error('Error getting extension version:', error);
      return 'unknown';
    }
  }

  public getToolbarInstalled(): boolean {
    return this.toolbarInstalled;
  }

  public getToolbarInstalledVersion(): string | null {
    return this.toolbarInstalledVersion;
  }

  public getLatestAvailableToolbarVersion(): string | null {
    return this.latestToolbarVersion;
  }

  public getWorkspaceLoaded(): boolean {
    return this.workspaceLoaded;
  }

  public getToolbarInstallations(): Array<{ version: string; path: string }> {
    return [...this.toolbarInstallations];
  }

  public getLatestAvailableExtensionVersion(): string | null {
    return this.latestExtensionVersion;
  }

  private isFixedVersion(version: string): boolean {
    // Check if version is a fixed version (e.g., "1.2.3")
    // Not a range (e.g., "^1.2.3", "~1.2.3", ">=1.2.3")
    // Not a workspace/link (e.g., "workspace:*", "file:../path", "link:../path")
    return /^\d+\.\d+\.\d+$/.test(version);
  }

  private isWorkspaceOrLink(version: string): boolean {
    return (
      version.startsWith('workspace:') ||
      version.startsWith('file:') ||
      version.startsWith('link:')
    );
  }

  private async checkToolbarInstallation() {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      this.workspaceLoaded = !!workspaceFolders;

      if (!workspaceFolders) {
        this.toolbarInstalled = false;
        this.toolbarInstalledVersion = null;
        this.toolbarInstallations = [];
        return;
      }

      this.toolbarInstallations = [];
      let oldestVersion: string | null = null;

      for (const folder of workspaceFolders) {
        // Check package.json files
        const packageJsonPath = path.join(folder.uri.fsPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJsonContent = fs.readFileSync(
              packageJsonPath,
              'utf-8',
            );
            const packageJson = JSON.parse(packageJsonContent);
            const dependencies = {
              ...(packageJson.dependencies || {}),
              ...(packageJson.devDependencies || {}),
            };

            for (const [dep, version] of Object.entries(dependencies)) {
              if (dep.startsWith('@stagewise/toolbar')) {
                const versionStr = version as string;

                // Skip if it's a version range
                if (
                  !this.isFixedVersion(versionStr) &&
                  !this.isWorkspaceOrLink(versionStr)
                ) {
                  continue;
                }

                const finalVersion = this.isWorkspaceOrLink(versionStr)
                  ? EnvironmentInfo.WORKSPACE_VERSION
                  : versionStr;

                this.toolbarInstallations.push({
                  version: finalVersion,
                  path: packageJsonPath,
                });

                if (
                  !oldestVersion ||
                  this.compareVersions(finalVersion, oldestVersion) < 0
                ) {
                  oldestVersion = finalVersion;
                }
              }
            }
          } catch (error) {
            console.error(
              `Error processing package.json at ${packageJsonPath}:`,
              error,
            );
          }
        }

        // Check lock files
        const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
        for (const lockFile of lockFiles) {
          const lockFilePath = path.join(folder.uri.fsPath, lockFile);
          if (fs.existsSync(lockFilePath)) {
            try {
              const content = fs.readFileSync(lockFilePath, 'utf-8');
              const toolbarRegex =
                /@stagewise\/toolbar(?:-[^"'\s]*)?@([^"'\s]+)/g;
              let match: RegExpExecArray | null = toolbarRegex.exec(content);

              while (match !== null) {
                const version = match[1];
                // For lock files, we only care about fixed versions
                if (this.isFixedVersion(version)) {
                  this.toolbarInstallations.push({
                    version,
                    path: lockFilePath,
                  });
                  if (
                    !oldestVersion ||
                    this.compareVersions(version, oldestVersion) < 0
                  ) {
                    oldestVersion = version;
                  }
                }
                match = toolbarRegex.exec(content);
              }
            } catch (error) {
              console.error(
                `Error processing lock file ${lockFilePath}:`,
                error,
              );
            }
          }
        }
      }

      this.toolbarInstalled = this.toolbarInstallations.length > 0;
      this.toolbarInstalledVersion = oldestVersion;
    } catch (error) {
      console.error('Error in checkToolbarInstallation:', error);
      // Set safe default values
      this.toolbarInstalled = false;
      this.toolbarInstalledVersion = null;
      this.toolbarInstallations = [];
    }
  }

  private async fetchLatestToolbarVersion() {
    try {
      const response = await axios.get(
        'https://registry.npmjs.org/@stagewise/toolbar/latest',
        { timeout: 5000 }, // Add timeout to prevent hanging
      );
      this.latestToolbarVersion = response.data.version;
    } catch (error) {
      console.error('Failed to fetch latest toolbar version:', error);
      this.latestToolbarVersion = null;
    }
  }

  private async fetchLatestExtensionVersion() {
    try {
      const versions = await Promise.allSettled([
        this.fetchFromVSCodeMarketplace(),
        this.fetchFromOpenVSX(),
      ]);

      const validVersions = versions
        .filter(
          (result): result is PromiseFulfilledResult<string> =>
            result.status === 'fulfilled' &&
            result.value !== null &&
            result.value !== undefined &&
            typeof result.value === 'string',
        )
        .map((result) => result.value);

      if (validVersions.length === 0) {
        this.latestExtensionVersion = null;
        return;
      }

      // Find the newest version by comparing all found versions
      this.latestExtensionVersion = validVersions.reduce((newest, current) => {
        return this.compareVersions(current, newest) > 0 ? current : newest;
      }, validVersions[0]);
    } catch (error) {
      console.error('Failed to fetch latest extension version:', error);
      this.latestExtensionVersion = null;
    }
  }

  private async fetchFromVSCodeMarketplace(): Promise<string | null> {
    try {
      const response = await axios.post(
        'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=3.0-preview.1',
        {
          filters: [
            {
              criteria: [
                {
                  filterType: 7, // ExtensionName
                  value: 'stagewise.stagewise-vscode-extension',
                },
              ],
              pageSize: 1,
              pageNumber: 1,
            },
          ],
          flags: 0x200, // IncludeVersions flag
        },
        {
          timeout: 5000,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );

      const extensions = response.data?.results?.[0]?.extensions;
      if (extensions && extensions.length > 0) {
        const versions = extensions[0].versions;
        if (versions && versions.length > 0) {
          // Get the latest version
          return versions[0].version;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch from VS Code Marketplace:', error);
      return null;
    }
  }

  private async fetchFromOpenVSX(): Promise<string | null> {
    try {
      const response = await axios.get(
        'https://open-vsx.org/api/stagewise/stagewise-vscode-extension/latest',
        {
          timeout: 5000,
          headers: {
            Accept: 'application/json',
          },
        },
      );
      return response.data?.version || null;
    } catch (error) {
      console.error('Failed to fetch from Open VSX Registry:', error);
      return null;
    }
  }

  private compareVersions(
    version1: string | undefined | null,
    version2: string | undefined | null,
  ): number {
    try {
      // Handle undefined, null, or empty strings
      if (!version1 || !version2) {
        return 0;
      }

      if (version1 === 'dev' || version2 === 'dev') {
        return 0;
      }

      const v1Parts = version1.split('.').map(Number);
      const v2Parts = version2.split('.').map(Number);

      for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1 = v1Parts[i] || 0;
        const v2 = v2Parts[i] || 0;

        if (v1 > v2) return 1;
        if (v1 < v2) return -1;
      }

      return 0;
    } catch (error) {
      console.error('Error comparing versions:', error);
      // Return 0 (equal) as a safe default
      return 0;
    }
  }
}
