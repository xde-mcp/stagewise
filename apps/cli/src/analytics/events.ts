import { posthog } from './posthog';
import type { TelemetryLevel } from '../config/telemetry';
import { log } from '@/utils/logger';

export interface CliStartProperties {
  mode: 'bridge' | 'regular';
  workspace_configured_manually: boolean;
  auto_plugins_enabled: boolean;
  manual_plugins_count: number;
}

export const analyticsEvents = {
  /**
   * Track telemetry configuration changes
   */
  telemetryConfigSet: async (level: TelemetryLevel) => {
    log.debug(`[TELEMETRY] Telemetry config set to ${level}`);
    await posthog.capture('cli-telemetry-config-set', {
      configured_level: level,
    });
  },

  /**
   * Track CLI startup
   */
  cliStart: async (properties: CliStartProperties) => {
    log.debug(`[TELEMETRY] CLI started ${JSON.stringify(properties)}`);
    await posthog.capture('cli-start', properties);
  },

  /**
   * Track when user stores config JSON
   */
  storedConfigJson: async () => {
    log.debug('[TELEMETRY] Config JSON stored');
    await posthog.capture('cli-stored-config-json');
  },

  /**
   * Track when workspace has config JSON
   */
  foundConfigJson: async () => {
    log.debug('[TELEMETRY] Found config JSON');
    await posthog.capture('cli-found-config-json');
  },

  /**
   * Track user prompts (if integrated)
   */
  sendPrompt: async () => {
    log.debug('[TELEMETRY] Sending prompt');
    await posthog.capture('cli-send-prompt');
  },

  /**
   * Track CLI shutdown
   */
  cliShutdown: async () => {
    log.debug('[TELEMETRY]CLI shutdown');
    await posthog.capture('cli-shutdown');
    // Give PostHog time to flush the event
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};
