import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { analyticsEvents } from './events';
import * as posthogModule from './posthog';

vi.mock('./posthog', () => ({
  posthog: {
    capture: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('analyticsEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('telemetryConfigSet', () => {
    it('should capture telemetry config set event', async () => {
      await analyticsEvents.telemetryConfigSet('full');
      
      expect(posthogModule.posthog.capture).toHaveBeenCalledWith(
        'cli-telemetry-config-set',
        { configured_level: 'full' }
      );
    });
  });

  describe('cliStart', () => {
    it('should capture CLI start event with all properties', async () => {
      await analyticsEvents.cliStart({
        mode: 'regular',
        workspace_configured_manually: true,
        auto_plugins_enabled: true,
        manual_plugins_count: 3,
      });
      
      expect(posthogModule.posthog.capture).toHaveBeenCalledWith(
        'cli-start',
        {
          mode: 'regular',
          workspace_configured_manually: true,
          auto_plugins_enabled: true,
          manual_plugins_count: 3,
        }
      );
    });
  });

  describe('storedConfigJson', () => {
    it('should capture stored config json event', async () => {
      await analyticsEvents.storedConfigJson();
      
      expect(posthogModule.posthog.capture).toHaveBeenCalledWith(
        'cli-stored-config-json'
      );
    });
  });

  describe('foundConfigJson', () => {
    it('should capture found config json event', async () => {
      await analyticsEvents.foundConfigJson();
      
      expect(posthogModule.posthog.capture).toHaveBeenCalledWith(
        'cli-found-config-json'
      );
    });
  });

  describe('sendPrompt', () => {
    it('should capture send prompt event', async () => {
      await analyticsEvents.sendPrompt();
      
      expect(posthogModule.posthog.capture).toHaveBeenCalledWith(
        'cli-send-prompt'
      );
    });
  });

  describe('cliShutdown', () => {
    it('should capture CLI shutdown event', async () => {
      await analyticsEvents.cliShutdown();
      
      expect(posthogModule.posthog.capture).toHaveBeenCalledWith(
        'cli-shutdown'
      );
    });
  });
});