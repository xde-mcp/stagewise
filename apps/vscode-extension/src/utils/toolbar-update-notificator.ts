import * as vscode from 'vscode';
import type { ExtensionStorage } from '../data-storage';
import { EnvironmentInfo } from './environment-info';
import { updateToolbar } from 'src/auto-prompts/update-toolbar';
import { compareVersions } from './lock-file-parsers/version-comparator';
import { trackEvent } from './analytics';

interface ToolbarVersionInfo {
  installedVersion: string;
  latestVersion: string;
  workspaceId: string;
}

export class ToolbarUpdateNotificator {
  private static readonly STORAGE_KEY_PREFIX = 'toolbar_version_';
  private storage: ExtensionStorage;
  private environmentInfo: EnvironmentInfo | null = null;
  private disposables: vscode.Disposable[] = [];

  constructor(storage: ExtensionStorage) {
    this.storage = storage;
    this.setupWorkspaceListener();
  }

  private setupWorkspaceListener() {
    // Listen for workspace folder changes
    const workspaceListener = vscode.workspace.onDidChangeWorkspaceFolders(
      async () => {
        const workspaceId = vscode.env.machineId;
        if (workspaceId) {
          await this.checkForUpdates(workspaceId);
        }
      },
    );

    // Also check when the extension is activated
    const initialWorkspaceId = vscode.env.machineId;
    if (initialWorkspaceId) {
      this.checkForUpdates(initialWorkspaceId).catch((error) => {
        console.error(
          '[ToolbarUpdateNotificator] Error checking for updates on initial load:',
          error,
        );
      });
    }

    this.disposables.push(workspaceListener);
  }

  public dispose() {
    console.log('[ToolbarUpdateNotificator] Disposing...');
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  /**
   * Checks if the toolbar needs an update and shows a notification if necessary
   * @param workspaceId The unique identifier of the current workspace
   */
  public async checkForUpdates(workspaceId: string): Promise<void> {
    if (!this.environmentInfo) {
      this.environmentInfo = await EnvironmentInfo.getInstance();
    }

    const installedVersion = this.environmentInfo.getToolbarInstalledVersion();
    const latestVersion =
      this.environmentInfo.getLatestAvailableToolbarVersion();

    if (!installedVersion || !latestVersion) {
      return;
    }

    // Skip version check for development versions
    if (installedVersion === 'dev') {
      return;
    }

    const storageKey = `${ToolbarUpdateNotificator.STORAGE_KEY_PREFIX}${workspaceId}`;
    const storedVersion =
      await this.storage.get<ToolbarVersionInfo>(storageKey);

    // If we've already notified about this version, don't show again
    if (storedVersion?.latestVersion === latestVersion) {
      return;
    }

    // Compare versions (assuming semantic versioning)
    if (compareVersions(installedVersion, latestVersion) < 0) {
      this.showUpdateNotification(
        storageKey,
        workspaceId,
        installedVersion,
        latestVersion,
      );
    }
  }

  private async showUpdateNotification(
    storageKey: string,
    workspaceId: string,
    installedVersion: string,
    latestVersion: string,
  ): Promise<void> {
    const message = `A new version of the stagewise toolbar is available (${latestVersion}). You are currently using version ${installedVersion}. We highly recommend updating to benefit from the latest features.`;

    const result = await vscode.window.showInformationMessage(
      message,
      'Auto-update',
      'Ignore',
    );
    trackEvent('show-toolbar-update-notification');

    if (result === 'Ignore') {
      // Store the version info to prevent showing the notification again
      trackEvent('toolbar-update-notification-ignored');
      await this.storage.set<ToolbarVersionInfo>(storageKey, {
        installedVersion,
        latestVersion,
        workspaceId,
      });
    } else if (result === 'Auto-update') {
      trackEvent('toolbar-update-notification-auto-update');
      await this.sendToolbarAutoUpdatePrompt(workspaceId, latestVersion);
    }
  }

  private async sendToolbarAutoUpdatePrompt(
    workspaceId: string,
    targetVersion: string,
  ): Promise<void> {
    console.log('[ToolbarUpdateNotificator] Sending auto-update prompt:', {
      workspaceId,
      targetVersion,
    });
    // Dummy function for auto-update functionality
    console.log(
      `Auto-update requested for workspace ${workspaceId} to version ${targetVersion}`,
    );
    await updateToolbar();
    await vscode.window.showInformationMessage(
      "The agent has been started to update your stagewise packages. Please follow the agent's instructions in the chat panel.",
      'OK',
    );
  }
}
