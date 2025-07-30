import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies first
vi.mock('../config/telemetry');
vi.mock('../utils/identifier');
vi.mock('../utils/logger', () => ({
  log: {
    debug: vi.fn(),
  },
}));

// Mock posthog-node - the mocks need to be inside the factory function
vi.mock('posthog-node', () => {
  return {
    PostHog: vi.fn(),
  };
});

// Import after mocks
import { PostHogClient } from './posthog';
import * as telemetryModule from '../config/telemetry';
import * as identifierModule from '../utils/identifier';
import { PostHog } from 'posthog-node';

// Get the mocked constructor
const MockedPostHog = vi.mocked(PostHog);

describe('PostHogClient', () => {
  let posthogClient: PostHogClient;
  let mockCapture: ReturnType<typeof vi.fn>;
  let mockShutdown: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mock functions for each test
    mockCapture = vi.fn();
    mockShutdown = vi.fn().mockResolvedValue(undefined);

    // Setup PostHog mock implementation
    MockedPostHog.mockImplementation(
      () =>
        ({
          capture: mockCapture,
          shutdown: mockShutdown,
        }) as any,
    );

    // Reset singleton
    (PostHogClient as any).instance = undefined;
    posthogClient = PostHogClient.getInstance();

    // Setup default mocks
    vi.mocked(telemetryModule.telemetryManager.getLevel).mockResolvedValue(
      'anonymous',
    );
    vi.mocked(
      identifierModule.identifierManager.getMachineId,
    ).mockResolvedValue('test-machine-id');

    // Set up PostHog API key
    process.env.POSTHOG_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.POSTHOG_API_KEY;
  });

  describe('initialize', () => {
    it('should not initialize when telemetry is off', async () => {
      vi.mocked(telemetryModule.telemetryManager.getLevel).mockResolvedValue(
        'off',
      );

      await posthogClient.initialize();

      expect(MockedPostHog).not.toHaveBeenCalled();
      expect((posthogClient as any).initialized).toBe(false);
      expect((posthogClient as any).client).toBeNull();
    });

    it('should not initialize without API key', async () => {
      delete process.env.POSTHOG_API_KEY;

      await posthogClient.initialize();

      expect(MockedPostHog).not.toHaveBeenCalled();
      expect((posthogClient as any).initialized).toBe(false);
      expect((posthogClient as any).client).toBeNull();
    });

    it('should initialize with valid config', async () => {
      await posthogClient.initialize();

      expect(MockedPostHog).toHaveBeenCalledWith('test-api-key', {
        host: 'https://app.posthog.com',
        flushAt: 1,
        flushInterval: 0,
      });
      expect((posthogClient as any).initialized).toBe(true);
      expect((posthogClient as any).client).toBeTruthy();
    });

    it('should only initialize once', async () => {
      await posthogClient.initialize();
      await posthogClient.initialize();

      expect(MockedPostHog).toHaveBeenCalledTimes(1);
    });
  });

  describe('capture', () => {
    it('should not capture events when telemetry is off', async () => {
      vi.mocked(telemetryModule.telemetryManager.getLevel).mockResolvedValue(
        'off',
      );

      await posthogClient.capture('test-event', { test: true });

      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('should capture events with anonymous telemetry', async () => {
      await posthogClient.initialize();
      await posthogClient.capture('test-event', { test: true });

      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: 'test-machine-id',
        event: 'test-event',
        properties: {
          test: true,
          telemetry_level: 'anonymous',
        },
      });
    });

    it('should include user properties with full telemetry', async () => {
      vi.mocked(telemetryModule.telemetryManager.getLevel).mockResolvedValue(
        'full',
      );
      await posthogClient.initialize();
      posthogClient.setUserProperties({
        user_id: 'user-123',
        user_email: 'test@example.com',
      });

      await posthogClient.capture('test-event', { test: true });

      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: 'test-machine-id',
        event: 'test-event',
        properties: {
          test: true,
          telemetry_level: 'full',
          user_id: 'user-123',
          user_email: 'test@example.com',
        },
      });
    });

    it('should not include user properties with anonymous telemetry', async () => {
      await posthogClient.initialize();
      posthogClient.setUserProperties({
        user_id: 'user-123',
        user_email: 'test@example.com',
      });

      await posthogClient.capture('test-event', { test: true });

      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: 'test-machine-id',
        event: 'test-event',
        properties: {
          test: true,
          telemetry_level: 'anonymous',
        },
      });
    });

    it('should not capture events when not initialized', async () => {
      // Don't initialize, just try to capture
      await posthogClient.capture('test-event', { test: true });

      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should shutdown PostHog client when initialized', async () => {
      await posthogClient.initialize();
      await posthogClient.shutdown();

      expect(mockShutdown).toHaveBeenCalled();
    });

    it('should handle shutdown when not initialized', async () => {
      await expect(posthogClient.shutdown()).resolves.not.toThrow();
      expect(mockShutdown).not.toHaveBeenCalled();
    });
  });
});
