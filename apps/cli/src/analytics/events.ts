import { posthog } from './posthog';
import { TelemetryLevel } from '../config/telemetry';

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
    await posthog.capture('cli-telemetry-config-set', {
      configured_level: level,
    });
  },

  /**
   * Track CLI startup
   */
  cliStart: async (properties: CliStartProperties) => {
    await posthog.capture('cli-start', properties);
  },

  /**
   * Track when user stores config JSON
   */
  storedConfigJson: async () => {
    await posthog.capture('cli-stored-config-json');
  },

  /**
   * Track when workspace has config JSON
   */
  foundConfigJson: async () => {
    await posthog.capture('cli-found-config-json');
  },

  /**
   * Track user prompts (if integrated)
   */
  sendPrompt: async () => {
    await posthog.capture('cli-send-prompt');
  },

  /**
   * Track CLI shutdown
   */
  cliShutdown: async () => {
    await posthog.capture('cli-shutdown');
    // Give PostHog time to flush the event
    await new Promise(resolve => setTimeout(resolve, 100));
  },
};