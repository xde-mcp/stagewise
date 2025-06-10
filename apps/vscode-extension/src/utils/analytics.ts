import * as vscode from 'vscode';
import { PostHog } from 'posthog-node';
import { createHash } from 'node:crypto';
import { EnvironmentInfo } from './environment-info';

// Initialize PostHog client
// Note: The API key should be your actual PostHog API key
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com';
const SALT = 'stagewise';

export const client = POSTHOG_API_KEY
  ? new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      disableGeoip: true,
    })
  : null;

function hashId(id: string): string {
  return createHash('sha256')
    .update(id + SALT)
    .digest('hex');
}

/**
 * Gets the extension version and toolbar version using EnvironmentInfo
 * @returns Object containing extension and toolbar versions
 */
async function getVersions() {
  const environmentInfo = await EnvironmentInfo.getInstance();
  return {
    extensionVersion: environmentInfo.getExtensionVersion(),
    toolbarVersion: environmentInfo.getToolbarInstalledVersion() || 'unknown',
  };
}

/**
 * Checks if analytics/telemetry is enabled in the extension settings
 * @returns boolean indicating if analytics is enabled
 */
export function isAnalyticsEnabled(): boolean {
  const config = vscode.workspace.getConfiguration('stagewise');
  return config.get<boolean>('telemetry.enabled', true);
}

/**
 * Tracks an event using PostHog if analytics is enabled
 * @param eventName The name of the event to track
 * @param properties Optional properties to include with the event
 */
export async function trackEvent(
  eventName: string,
  properties?: Record<string, any>,
  context?: vscode.ExtensionContext,
): Promise<void> {
  if (!isAnalyticsEnabled()) {
    return;
  }

  try {
    const machineId = vscode.env.machineId;
    const { extensionVersion, toolbarVersion } = await getVersions();

    const eventData = {
      distinctId: hashId(machineId),
      event: eventName,
      properties: {
        ...properties,
        vscodeVersion: vscode.version,
        appName: vscode.env.appName,
        extensionVersion,
        toolbarVersion,
        platform: process.platform,
      },
    };

    await client?.capture(eventData);

    // Enhanced debug logging
    if (context?.extensionMode === vscode.ExtensionMode.Development) {
      console.log(
        '[Analytics] Event data:',
        JSON.stringify(eventData, null, 2),
      );
    }
  } catch (error) {
    if (context?.extensionMode === vscode.ExtensionMode.Development) {
      console.error('[Analytics] Error sending event to PostHog:', error);
    }
  }
}

/**
 * Shuts down the PostHog client gracefully
 * Should be called when the extension is deactivated
 */
export async function shutdownAnalytics(): Promise<void> {
  await client?.shutdown();
}

/**
 * Special function to track telemetry state changes
 * This bypasses the normal isAnalyticsEnabled() check for the disable event
 * since we want to track when users opt-out before respecting their choice
 */
export async function trackTelemetryStateChange(
  enabled: boolean,
  context?: vscode.ExtensionContext,
): Promise<void> {
  try {
    const machineId = vscode.env.machineId;
    const eventName = enabled ? 'telemetry_enabled' : 'telemetry_disabled';
    const { extensionVersion, toolbarVersion } = await getVersions();

    const eventData = {
      distinctId: hashId(machineId),
      event: eventName,
      properties: {
        vscodeVersion: vscode.version,
        appName: vscode.env.appName,
        extensionVersion,
        toolbarVersion,
        platform: process.platform,
      },
    };

    await client?.capture(eventData);

    if (context?.extensionMode === vscode.ExtensionMode.Development) {
      console.log(
        '[Analytics] Telemetry state change event data:',
        JSON.stringify(eventData, null, 2),
      );
    }
  } catch (error) {
    if (context?.extensionMode === vscode.ExtensionMode.Development) {
      console.error(
        '[Analytics] Error tracking telemetry state change:',
        error,
      );
    }
  }
}
