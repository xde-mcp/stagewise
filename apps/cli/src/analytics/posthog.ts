import { PostHog } from 'posthog-node';
import { identifierManager } from '../utils/identifier';
import { telemetryManager } from '../config/telemetry';
import { log } from '../utils/logger';

export interface EventProperties {
  [key: string]: any;
}

export interface UserProperties {
  user_id?: string;
  user_email?: string;
}

export class PostHogClient {
  private static instance: PostHogClient;
  private client: PostHog | null = null;
  private initialized = false;
  private userProperties: UserProperties = {};

  private constructor() {}

  static getInstance(): PostHogClient {
    if (!PostHogClient.instance) {
      PostHogClient.instance = new PostHogClient();
    }
    return PostHogClient.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const telemetryLevel = await telemetryManager.getLevel();
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
      this.client = new PostHog(apiKey, {
        host: 'https://app.posthog.com',
        flushAt: 1, // Send events immediately in CLI context
        flushInterval: 0, // Don't batch events
      });
      
      this.initialized = true;
      log.debug('PostHog analytics initialized');
    } catch (error) {
      log.debug(`Failed to initialize PostHog: ${error}`);
    }
  }

  setUserProperties(properties: UserProperties): void {
    this.userProperties = { ...this.userProperties, ...properties };
  }

  async capture(
    eventName: string,
    properties?: EventProperties,
  ): Promise<void> {
    try {
      const telemetryLevel = await telemetryManager.getLevel();
      
      if (telemetryLevel === 'off' || !this.client) {
        return;
      }

      const machineId = await identifierManager.getMachineId();
      
      // Build final properties
      const finalProperties: EventProperties = {
        ...properties,
        telemetry_level: telemetryLevel,
      };

      // Add user_id only if telemetry is set to 'full'
      if (telemetryLevel === 'full' && this.userProperties.user_id) {
        finalProperties.user_id = this.userProperties.user_id;
        finalProperties.user_email = this.userProperties.user_email;
      }

      // Capture the event
      this.client.capture({
        distinctId: machineId,
        event: eventName,
        properties: finalProperties,
      });

      log.debug(`Analytics event captured: ${eventName}`);
    } catch (error) {
      // Silently fail - analytics should not break the app
      log.debug(`Failed to capture analytics event: ${error}`);
    }
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      try {
        await this.client.shutdown();
        log.debug('PostHog analytics shut down');
      } catch (error) {
        log.debug(`Failed to shutdown PostHog: ${error}`);
      }
    }
  }
}

export const posthog = PostHogClient.getInstance();