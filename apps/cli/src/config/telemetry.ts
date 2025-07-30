import { readConfigFile, writeConfigFile } from '../utils/config-path';

export type TelemetryLevel = 'off' | 'anonymous' | 'full';

export interface TelemetryConfig {
  level: TelemetryLevel;
}

const TELEMETRY_CONFIG_FILE = 'telemetry.json';
const DEFAULT_TELEMETRY_LEVEL: TelemetryLevel = 'anonymous';

export class TelemetryManager {
  private static instance: TelemetryManager;
  private config: TelemetryConfig | null = null;

  private constructor() {}

  static getInstance(): TelemetryManager {
    if (!TelemetryManager.instance) {
      TelemetryManager.instance = new TelemetryManager();
    }
    return TelemetryManager.instance;
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
