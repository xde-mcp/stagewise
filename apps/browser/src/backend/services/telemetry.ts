import { PostHog } from 'posthog-node';
import type { LanguageModelV3 } from '@ai-sdk/provider';
import { withTracing } from '@posthog/ai';
import type { IdentifierService } from './identifier';
import type { PreferencesService } from './preferences';
import type { TelemetryLevel } from '@shared/karton-contracts/ui/shared-types';
import type { Logger } from './logger';
import { DisposableService } from './disposable';

export type EventProperties = {
  noop: undefined; // TODO: Figure out which events we want to capture later, after capturing all exceptions
};

export interface UserProperties {
  user_id?: string;
  user_email?: string;
}

export class TelemetryService extends DisposableService {
  private readonly identifierService: IdentifierService;
  private readonly preferencesService: PreferencesService;
  private readonly logger: Logger;
  private userProperties: UserProperties = {};
  public posthogClient: PostHog;

  public constructor(
    identifierService: IdentifierService,
    preferencesService: PreferencesService,
    logger: Logger,
  ) {
    super();
    this.identifierService = identifierService;
    this.preferencesService = preferencesService;
    this.logger = logger;
    const apiKey = process.env.POSTHOG_API_KEY ?? '';
    this.posthogClient = new PostHog(apiKey, {
      host: process.env.POSTHOG_HOST || 'https://eu.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
      disabled:
        this.getTelemetryLevel() === 'off' ||
        process.env.POSTHOG_API_KEY === undefined,
    });

    this.identifyUser();

    this.preferencesService.addListener((newPrefs, oldPrefs) => {
      if (newPrefs.privacy.telemetryLevel !== oldPrefs.privacy.telemetryLevel) {
        this.logger.debug(
          `[TelemetryService] Detected change to telemetry level.`,
        );
      }
    });

    logger.debug('[TelemetryService] Telemetry initialized');
  }

  /**
   * Get the current telemetry level from preferences.
   */
  private getTelemetryLevel(): TelemetryLevel {
    return this.preferencesService.get().privacy.telemetryLevel;
  }

  setUserProperties(properties: UserProperties): void {
    this.userProperties = { ...this.userProperties, ...properties };
  }

  private getDistinctId(): string {
    return this.getTelemetryLevel() === 'full' && this.userProperties.user_id
      ? this.userProperties.user_id
      : this.identifierService.getMachineId();
  }

  identifyUser() {
    if (
      this.userProperties.user_id &&
      this.userProperties.user_email &&
      this.getTelemetryLevel() === 'full'
    ) {
      this.logger.debug('[TelemetryService] Identifying user...');
      this.posthogClient.identify({
        distinctId: this.userProperties.user_id,
        properties: {
          email: this.userProperties.user_email,
        },
      });
      this.posthogClient.alias({
        alias: this.userProperties.user_id,
        distinctId: this.identifierService.getMachineId(),
      });
    } else {
      this.logger.debug(
        '[TelemetryService] Not identifying user, missing user properties or telemetry level is not "full"',
      );
    }
  }

  public withTracing(
    model: LanguageModelV3,
    properties?: Parameters<typeof withTracing>[2],
  ): LanguageModelV3 {
    const telemetryLevel = this.getTelemetryLevel();
    if (telemetryLevel !== 'full') return model;

    const distinctId = this.getDistinctId();

    const wrappedModel = withTracing(model, this.posthogClient, {
      posthogDistinctId: distinctId,
      ...properties,
      posthogProperties: {
        telemetry_level: telemetryLevel,
        app_version: __APP_VERSION__,
        app_release_channel: __APP_RELEASE_CHANNEL__,
        app_platform: __APP_PLATFORM__,
        app_arch: __APP_ARCH__,
        ...properties?.posthogProperties,
      },
    });

    // Fix for AI SDK v6: PostHog's withTracing uses spread which doesn't copy
    // prototype getters like 'supportedUrls'. This property is required by the
    // AI SDK to determine which URL schemes the model supports for file uploads.
    // Without it, Object.entries(undefined) throws during asset download.
    if ('supportedUrls' in model && !('supportedUrls' in wrappedModel)) {
      Object.defineProperty(wrappedModel, 'supportedUrls', {
        get: () => model.supportedUrls,
        enumerable: true,
        configurable: true,
      });
    }

    return wrappedModel;
  }

  public capture<T extends keyof EventProperties>(
    eventName: T,
    properties?: EventProperties[T],
  ): void {
    try {
      this.logger.debug(
        `[TelemetryService] Capturing event: ${eventName} with properties: ${JSON.stringify(properties)}`,
      );
      const telemetryLevel = this.getTelemetryLevel();

      // TODO: Capture 'turning-telemetry-off' event when telemetry is turned off
      if (telemetryLevel === 'off' || !this.posthogClient) return;

      const distinctId = this.getDistinctId();

      const finalProperties = {
        ...(typeof properties === 'object' ? properties : {}),
        telemetry_level: telemetryLevel,
        app_version: __APP_VERSION__,
        app_release_channel: __APP_RELEASE_CHANNEL__,
        app_platform: __APP_PLATFORM__,
        app_arch: __APP_ARCH__,
      };

      this.posthogClient.capture({
        distinctId,
        event: eventName as string,
        properties: finalProperties,
      });
    } catch (error) {
      this.logger.error(
        `[TELEMETRY] Failed to capture analytics event: ${error}`,
      );
    }
  }

  public captureException(
    error: Error,
    properties?: Record<string, any>,
  ): void {
    const telemetryLevel = this.getTelemetryLevel();
    if (telemetryLevel === 'off') return;
    const distinctId = this.getDistinctId();

    this.posthogClient.captureException(error, distinctId, {
      properties: {
        ...properties,
        telemetry_level: telemetryLevel,
        app_version: __APP_VERSION__,
        app_release_channel: __APP_RELEASE_CHANNEL__,
        app_platform: __APP_PLATFORM__,
        app_arch: __APP_ARCH__,
      },
    });
  }

  protected async onTeardown(): Promise<void> {
    this.logger.debug('[TelemetryService] Tearing down...');
    if (this.posthogClient) {
      try {
        await this.posthogClient.shutdown();
      } catch (error) {
        this.logger.debug(`Failed to shutdown PostHog: ${error}`);
      }
    }
    this.logger.debug('[TelemetryService] Teardown complete');
  }
}
