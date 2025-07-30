import { readConfigFile, writeConfigFile } from './config-path';
import { PostHog } from 'posthog-node';
import { identifierManager } from './identifier';
import { log } from './logger';

export type TelemetryLevel = 'off' | 'anonymous' | 'full';

export interface TelemetryConfig {
  level: TelemetryLevel;
}

export interface EventProperties {
  [key: string]: any;
}

export interface UserProperties {
  user_id?: string;
  user_email?: string;
}

export interface CliStartProperties {
  mode: 'bridge' | 'regular';
  workspace_configured_manually: boolean;
  auto_plugins_enabled: boolean;
  manual_plugins_count: number;
}

const TELEMETRY_CONFIG_FILE = 'telemetry.json';
const DEFAULT_TELEMETRY_LEVEL: TelemetryLevel = 'anonymous';

export class TelemetryManager {
  private static instance: TelemetryManager;
  private config: TelemetryConfig | null = null;
  private posthogClient: PostHog | null = null;
  private initialized = false;
  private userProperties: UserProperties = {};

  private constructor() {}

  static getInstance(): TelemetryManager {
    if (!TelemetryManager.instance) {
      TelemetryManager.instance = new TelemetryManager();
    }
    return TelemetryManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const telemetryLevel = await this.getLevel();
    if (telemetryLevel === 'off') {
      log.debug('Telemetry is disabled, PostHog will not be initialized');
      return;
    }

    const apiKey = process.env.POSTHOG_API_KEY;
    if (!apiKey) {
      log.debug('POSTHOG_API_KEY not found, analytics disabled');
      return;
    }

    try {
      this.posthogClient = new PostHog(apiKey, {
        host: process.env.POSTHOG_HOST || 'https://eu.i.posthog.com',
        flushAt: 1,
        flushInterval: 0,
      });

      this.initialized = true;
      log.debug('PostHog analytics initialized');
    } catch (error) {
      log.debug(`Failed to initialize PostHog: ${error}`);
    }
  }

  async getLevel(): Promise<TelemetryLevel> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config?.level || DEFAULT_TELEMETRY_LEVEL;
  }

  async setLevel(level: TelemetryLevel): Promise<void> {
    this.config = { level };
    await writeConfigFile(TELEMETRY_CONFIG_FILE, this.config);
  }

  async getStatus(): Promise<TelemetryConfig> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config || { level: DEFAULT_TELEMETRY_LEVEL };
  }

  async isEnabled(): Promise<boolean> {
    const level = await this.getLevel();
    return level !== 'off';
  }

  async isFullTelemetryEnabled(): Promise<boolean> {
    const level = await this.getLevel();
    return level === 'full';
  }

  setUserProperties(properties: UserProperties): void {
    this.userProperties = { ...this.userProperties, ...properties };
  }

  async capture(
    eventName: string,
    properties?: EventProperties,
  ): Promise<void> {
    try {
      const telemetryLevel = await this.getLevel();

      if (telemetryLevel === 'off' || !this.posthogClient) {
        return;
      }

      const machineId = await identifierManager.getMachineId();

      const finalProperties: EventProperties = {
        ...properties,
        telemetry_level: telemetryLevel,
      };

      if (telemetryLevel === 'full' && this.userProperties.user_id) {
        finalProperties.user_id = this.userProperties.user_id;
        finalProperties.user_email = this.userProperties.user_email;
      }

      this.posthogClient.capture({
        distinctId: machineId,
        event: eventName,
        properties: finalProperties,
      });
    } catch (error) {
      log.debug(`[TELEMETRY] Failed to capture analytics event: ${error}`);
    }
  }

  async shutdown(): Promise<void> {
    if (this.posthogClient) {
      try {
        await this.posthogClient.shutdown();
        log.debug('PostHog analytics shut down');
      } catch (error) {
        log.debug(`Failed to shutdown PostHog: ${error}`);
      }
    }
  }

  async telemetryConfigSet(level: TelemetryLevel): Promise<void> {
    log.debug(`[TELEMETRY] Telemetry config set to ${level}`);
    await this.capture('cli-telemetry-config-set', {
      configured_level: level,
    });
  }

  async cliStart(properties: CliStartProperties): Promise<void> {
    log.debug(`[TELEMETRY] CLI started ${JSON.stringify(properties)}`);
    await this.capture('cli-start', properties);
  }

  async storedConfigJson(): Promise<void> {
    log.debug('[TELEMETRY] Config JSON stored');
    await this.capture('cli-stored-config-json');
  }

  async foundConfigJson(): Promise<void> {
    log.debug('[TELEMETRY] Found config JSON');
    await this.capture('cli-found-config-json');
  }

  async sendPrompt(): Promise<void> {
    log.debug('[TELEMETRY] Sending prompt');
    await this.capture('cli-send-prompt');
  }

  async cliShutdown(): Promise<void> {
    log.debug('[TELEMETRY]CLI shutdown');
    await this.capture('cli-shutdown');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async loadConfig(): Promise<void> {
    const config = await readConfigFile<TelemetryConfig>(TELEMETRY_CONFIG_FILE);
    if (config && this.isValidTelemetryLevel(config.level)) {
      this.config = config;
    } else {
      this.config = { level: DEFAULT_TELEMETRY_LEVEL };
    }
  }

  private isValidTelemetryLevel(level: unknown): level is TelemetryLevel {
    return (
      typeof level === 'string' && ['off', 'anonymous', 'full'].includes(level)
    );
  }
}

export const telemetryManager = TelemetryManager.getInstance();

export async function getTelemetryLevel() {
  return telemetryManager.getLevel();
}

export async function isTelemetryEnabled() {
  return telemetryManager.isEnabled();
}

export async function isFullTelemetryEnabled() {
  return telemetryManager.isFullTelemetryEnabled();
}

export const analyticsEvents = {
  telemetryConfigSet: (level: TelemetryLevel) =>
    telemetryManager.telemetryConfigSet(level),
  cliStart: (properties: CliStartProperties) =>
    telemetryManager.cliStart(properties),
  storedConfigJson: () => telemetryManager.storedConfigJson(),
  foundConfigJson: () => telemetryManager.foundConfigJson(),
  sendPrompt: () => telemetryManager.sendPrompt(),
  cliShutdown: () => telemetryManager.cliShutdown(),
};
