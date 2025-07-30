import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryManager } from '../../../../src/utils/telemetry';
import * as configPath from '../../../../src/utils/config-path';
import { identifierManager } from '../../../../src/utils/identifier';
import { PostHog } from 'posthog-node';

vi.mock('../../../../src/utils/config-path', () => ({
  readConfigFile: vi.fn(),
  writeConfigFile: vi.fn(),
}));

vi.mock('../../../../src/utils/identifier', () => ({
  identifierManager: {
    getMachineId: vi.fn(),
  },
}));

vi.mock('posthog-node', () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../../../src/utils/logger', () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Unified TelemetryManager', () => {
  let telemetryManager: TelemetryManager;
  let mockPostHogInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton instance
    (TelemetryManager as any).instance = undefined;
    telemetryManager = TelemetryManager.getInstance();
    
    // Reset config cache
    (telemetryManager as any).config = null;
    (telemetryManager as any).initialized = false;
    
    // Get mock PostHog instance
    mockPostHogInstance = {
      capture: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(PostHog).mockImplementation(() => mockPostHogInstance);
    
    // Set environment variables
    process.env.POSTHOG_API_KEY = 'test-api-key';
    process.env.POSTHOG_HOST = 'https://test.posthog.com';
    
    // Set up default mock for getMachineId
    vi.mocked(identifierManager.getMachineId).mockResolvedValue('test-machine-id');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.POSTHOG_API_KEY;
    delete process.env.POSTHOG_HOST;
  });

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = TelemetryManager.getInstance();
      const instance2 = TelemetryManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Telemetry level management', () => {
    it('should return default level when no config exists', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue(null);

      const level = await telemetryManager.getLevel();

      expect(level).toBe('anonymous');
      expect(configPath.readConfigFile).toHaveBeenCalledWith('telemetry.json');
    });

    it('should return configured level when config exists', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'full' });

      const level = await telemetryManager.getLevel();

      expect(level).toBe('full');
    });

    it('should save telemetry level', async () => {
      await telemetryManager.setLevel('off');

      expect(configPath.writeConfigFile).toHaveBeenCalledWith(
        'telemetry.json',
        { level: 'off' },
      );
    });

    it('should validate telemetry levels', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({
        level: 'invalid',
      });

      const level = await telemetryManager.getLevel();

      expect(level).toBe('anonymous');
    });
  });

  describe('PostHog initialization', () => {
    it('should initialize PostHog when telemetry is enabled', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'anonymous' });

      await telemetryManager.initialize();

      expect(PostHog).toHaveBeenCalledWith('test-api-key', {
        host: 'https://test.posthog.com',
        flushAt: 1,
        flushInterval: 0,
      });
    });

    it('should not initialize PostHog when telemetry is off', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'off' });

      await telemetryManager.initialize();

      expect(PostHog).not.toHaveBeenCalled();
    });

    it('should not initialize PostHog without API key', async () => {
      delete process.env.POSTHOG_API_KEY;
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'anonymous' });

      await telemetryManager.initialize();

      expect(PostHog).not.toHaveBeenCalled();
    });

    it('should only initialize once', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'anonymous' });

      await telemetryManager.initialize();
      await telemetryManager.initialize();

      expect(PostHog).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event capturing', () => {
    beforeEach(async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'anonymous' });
      await telemetryManager.initialize();
    });

    it('should capture events when telemetry is enabled', async () => {
      await telemetryManager.capture('test-event', { foo: 'bar' });

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-machine-id',
        event: 'test-event',
        properties: {
          foo: 'bar',
          telemetry_level: 'anonymous',
        },
      });
    });

    it('should include user properties when telemetry level is full', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'full' });
      // Reset config to force reload with full level
      (telemetryManager as any).config = null;
      
      telemetryManager.setUserProperties({
        user_id: 'test-user',
        user_email: 'test@example.com',
      });

      await telemetryManager.capture('test-event', { foo: 'bar' });

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-machine-id',
        event: 'test-event',
        properties: {
          foo: 'bar',
          telemetry_level: 'full',
          user_id: 'test-user',
          user_email: 'test@example.com',
        },
      });
    });

    it('should not capture events when telemetry is off', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'off' });
      // Reset config to force reload
      (telemetryManager as any).config = null;
      
      await telemetryManager.capture('test-event', { foo: 'bar' });

      expect(mockPostHogInstance.capture).not.toHaveBeenCalled();
    });

    it('should not include user properties when telemetry level is anonymous', async () => {
      telemetryManager.setUserProperties({
        user_id: 'test-user',
        user_email: 'test@example.com',
      });

      await telemetryManager.capture('test-event', { foo: 'bar' });

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-machine-id',
        event: 'test-event',
        properties: {
          foo: 'bar',
          telemetry_level: 'anonymous',
        },
      });
    });
  });

  describe('Helper methods', () => {
    it('should check if telemetry is enabled', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'anonymous' });
      expect(await telemetryManager.isEnabled()).toBe(true);

      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'off' });
      // Reset config to force reload
      (telemetryManager as any).config = null;
      expect(await telemetryManager.isEnabled()).toBe(false);
    });

    it('should check if full telemetry is enabled', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'full' });
      expect(await telemetryManager.isFullTelemetryEnabled()).toBe(true);

      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'anonymous' });
      // Reset config to force reload
      (telemetryManager as any).config = null;
      expect(await telemetryManager.isFullTelemetryEnabled()).toBe(false);
    });

    it('should get telemetry status', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'full' });

      const status = await telemetryManager.getStatus();

      expect(status).toEqual({ level: 'full' });
    });
  });

  describe('Shutdown', () => {
    it('should shutdown PostHog client', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'anonymous' });
      await telemetryManager.initialize();

      await telemetryManager.shutdown();

      expect(mockPostHogInstance.shutdown).toHaveBeenCalled();
    });

    it('should handle shutdown when not initialized', async () => {
      await expect(telemetryManager.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Analytics events', () => {
    beforeEach(async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'anonymous' });
      await telemetryManager.initialize();
    });

    it('should capture telemetry config set event', async () => {
      await telemetryManager.telemetryConfigSet('full');

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-machine-id',
        event: 'cli-telemetry-config-set',
        properties: {
          configured_level: 'full',
          telemetry_level: 'anonymous',
        },
      });
    });

    it('should capture CLI start event', async () => {
      await telemetryManager.cliStart({
        mode: 'bridge',
        workspace_configured_manually: true,
        auto_plugins_enabled: false,
        manual_plugins_count: 2,
      });

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-machine-id',
        event: 'cli-start',
        properties: {
          mode: 'bridge',
          workspace_configured_manually: true,
          auto_plugins_enabled: false,
          manual_plugins_count: 2,
          telemetry_level: 'anonymous',
        },
      });
    });

    it('should capture stored config JSON event', async () => {
      await telemetryManager.storedConfigJson();

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-machine-id',
        event: 'cli-stored-config-json',
        properties: {
          telemetry_level: 'anonymous',
        },
      });
    });

    it('should capture found config JSON event', async () => {
      await telemetryManager.foundConfigJson();

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-machine-id',
        event: 'cli-found-config-json',
        properties: {
          telemetry_level: 'anonymous',
        },
      });
    });

    it('should capture send prompt event', async () => {
      await telemetryManager.sendPrompt();

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-machine-id',
        event: 'cli-send-prompt',
        properties: {
          telemetry_level: 'anonymous',
        },
      });
    });

    it('should capture CLI shutdown event', async () => {
      await telemetryManager.cliShutdown();

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: 'test-machine-id',
        event: 'cli-shutdown',
        properties: {
          telemetry_level: 'anonymous',
        },
      });
    });
  });
});