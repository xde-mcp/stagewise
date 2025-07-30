import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryManager } from './telemetry';
import * as configPath from '../utils/config-path';

vi.mock('../utils/config-path', () => ({
  readConfigFile: vi.fn(),
  writeConfigFile: vi.fn(),
}));

describe('TelemetryManager', () => {
  let telemetryManager: TelemetryManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance
    (TelemetryManager as any).instance = undefined;
    telemetryManager = TelemetryManager.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = TelemetryManager.getInstance();
      const instance2 = TelemetryManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getLevel', () => {
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

    it('should return default level for invalid config', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({
        level: 'invalid',
      });

      const level = await telemetryManager.getLevel();

      expect(level).toBe('anonymous');
    });

    it('should cache the config after first load', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'off' });

      await telemetryManager.getLevel();
      await telemetryManager.getLevel();

      expect(configPath.readConfigFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('setLevel', () => {
    it('should save the telemetry level', async () => {
      await telemetryManager.setLevel('off');

      expect(configPath.writeConfigFile).toHaveBeenCalledWith(
        'telemetry.json',
        { level: 'off' },
      );
    });

    it('should update cached config', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({
        level: 'anonymous',
      });

      await telemetryManager.getLevel();
      await telemetryManager.setLevel('full');
      const level = await telemetryManager.getLevel();

      expect(level).toBe('full');
      expect(configPath.readConfigFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStatus', () => {
    it('should return current config status', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue({ level: 'full' });

      const status = await telemetryManager.getStatus();

      expect(status).toEqual({ level: 'full' });
    });

    it('should return default config when no config exists', async () => {
      vi.mocked(configPath.readConfigFile).mockResolvedValue(null);

      const status = await telemetryManager.getStatus();

      expect(status).toEqual({ level: 'anonymous' });
    });
  });
});
