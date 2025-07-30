import { describe, expect, it, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import * as telemetryModule from '../config/telemetry';
import * as identifierModule from '../utils/identifier';

// Mock PostHog
const mockCapture = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);

vi.mock('posthog-node', () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: mockCapture,
    shutdown: mockShutdown,
  })),
}));

// Mock dependencies
vi.mock('../config/telemetry');
vi.mock('../utils/identifier');
vi.mock('../utils/logger', () => ({
  log: {
    debug: vi.fn(),
  },
}));

describe('PostHogClient', () => {
  let PostHogClient: any;
  let posthogClient: any;
  const mockPostHog = vi.fn();

  beforeAll(async () => {
    // Import after mocks are set up
    const module = await import('./posthog');
    PostHogClient = module.PostHogClient;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCapture.mockClear();
    mockShutdown.mockClear();
    // Reset singleton
    (PostHogClient as any).instance = undefined;
    posthogClient = PostHogClient.getInstance();
    
    // Setup default mocks
    vi.mocked(telemetryModule.telemetryManager.getLevel).mockResolvedValue('anonymous');
    vi.mocked(identifierModule.identifierManager.getMachineId).mockResolvedValue('test-machine-id');
    
    // Set up PostHog API key
    process.env.POSTHOG_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.POSTHOG_API_KEY;
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should not initialize when telemetry is off', async () => {
      vi.mocked(telemetryModule.telemetryManager.getLevel).mockResolvedValue('off');
      
      await posthogClient.initialize();
      
      // Check that PostHog was not instantiated
      const { PostHog } = await import('posthog-node');
      expect(PostHog).not.toHaveBeenCalled();
    });

    it('should not initialize without API key', async () => {
      delete process.env.POSTHOG_API_KEY;
      
      await posthogClient.initialize();
      
      // Check that PostHog was not instantiated
      const { PostHog } = await import('posthog-node');
      expect(PostHog).not.toHaveBeenCalled();
    });

    it('should initialize with valid config', async () => {
      await posthogClient.initialize();
      
      // Check that PostHog was instantiated
      const { PostHog } = await import('posthog-node');
      expect(PostHog).toHaveBeenCalledWith('test-api-key', expect.any(Object));
    });

    it('should only initialize once', async () => {
      await posthogClient.initialize();
      await posthogClient.initialize();
      
      // Check that PostHog constructor was only called once
      const { PostHog } = await import('posthog-node');
      expect(PostHog).toHaveBeenCalledTimes(1);
    });
  });

  describe('capture', () => {

    it('should not capture events when telemetry is off', async () => {
      vi.mocked(telemetryModule.telemetryManager.getLevel).mockResolvedValue('off');
      
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
      vi.mocked(telemetryModule.telemetryManager.getLevel).mockResolvedValue('full');
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
  });

  describe('shutdown', () => {
    it('should shutdown PostHog client when initialized', async () => {
      await posthogClient.initialize();
      await posthogClient.shutdown();
      
      expect(mockShutdown).toHaveBeenCalled();
    });

    it('should handle shutdown when not initialized', async () => {
      await expect(posthogClient.shutdown()).resolves.not.toThrow();
    });
  });
});