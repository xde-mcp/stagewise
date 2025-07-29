import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  stagewise,
  ensureDir,
  getConfigPath,
  getDataPath,
  readConfigFile,
  writeConfigFile,
  deleteConfigFile,
} from '../../../src/utils/config-path';

vi.mock('env-paths', () => ({
  default: () => ({
    config: '/test/config',
    data: '/test/data',
    cache: '/test/cache',
    log: '/test/log',
    temp: '/test/temp',
  }),
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
  },
}));

describe('config-path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('stagewise paths', () => {
    it('should return correct paths', () => {
      expect(stagewise.configDir).toBe('/test/config');
      expect(stagewise.dataDir).toBe('/test/data');
      expect(stagewise.cacheDir).toBe('/test/cache');
      expect(stagewise.logDir).toBe('/test/log');
      expect(stagewise.tempDir).toBe('/test/temp');
    });
  });

  describe('ensureDir', () => {
    it('should create directory with correct permissions', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);

      await ensureDir('/test/path');

      expect(fs.mkdir).toHaveBeenCalledWith('/test/path', {
        recursive: true,
        mode: 0o700,
      });
    });

    it('should throw error on failure', async () => {
      const error = new Error('mkdir failed');
      (fs.mkdir as any).mockRejectedValue(error);

      await expect(ensureDir('/test/path')).rejects.toThrow('mkdir failed');
    });
  });

  describe('getConfigPath', () => {
    it('should return path within config directory', () => {
      expect(getConfigPath('test.json')).toBe('/test/config/test.json');
    });
  });

  describe('getDataPath', () => {
    it('should return path within data directory', () => {
      expect(getDataPath('test.db')).toBe('/test/data/test.db');
    });
  });

  describe('readConfigFile', () => {
    it('should read and parse JSON file', async () => {
      const data = { key: 'value' };
      (fs.readFile as any).mockResolvedValue(JSON.stringify(data));

      const result = await readConfigFile('test.json');

      expect(fs.readFile).toHaveBeenCalledWith('/test/config/test.json', 'utf-8');
      expect(result).toEqual(data);
    });

    it('should return null for non-existent file', async () => {
      const error: any = new Error('File not found');
      error.code = 'ENOENT';
      (fs.readFile as any).mockRejectedValue(error);

      const result = await readConfigFile('missing.json');

      expect(result).toBeNull();
    });

    it('should throw error for other read failures', async () => {
      const error = new Error('Permission denied');
      (fs.readFile as any).mockRejectedValue(error);

      await expect(readConfigFile('test.json')).rejects.toThrow('Permission denied');
    });
  });

  describe('writeConfigFile', () => {
    it('should write JSON file with correct permissions', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);

      const data = { key: 'value' };
      await writeConfigFile('test.json', data);

      expect(fs.mkdir).toHaveBeenCalledWith('/test/config', {
        recursive: true,
        mode: 0o700,
      });
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/test/config/test.json',
        JSON.stringify(data, null, 2),
        { mode: 0o600 }
      );
    });

    it('should throw error on write failure', async () => {
      (fs.mkdir as any).mockResolvedValue(undefined);
      const error = new Error('Write failed');
      (fs.writeFile as any).mockRejectedValue(error);

      await expect(writeConfigFile('test.json', {})).rejects.toThrow('Write failed');
    });
  });

  describe('deleteConfigFile', () => {
    it('should delete file', async () => {
      (fs.unlink as any).mockResolvedValue(undefined);

      await deleteConfigFile('test.json');

      expect(fs.unlink).toHaveBeenCalledWith('/test/config/test.json');
    });

    it('should ignore non-existent file', async () => {
      const error: any = new Error('File not found');
      error.code = 'ENOENT';
      (fs.unlink as any).mockRejectedValue(error);

      await expect(deleteConfigFile('missing.json')).resolves.not.toThrow();
    });

    it('should throw error for other delete failures', async () => {
      const error = new Error('Permission denied');
      (fs.unlink as any).mockRejectedValue(error);

      await expect(deleteConfigFile('test.json')).rejects.toThrow('Permission denied');
    });
  });
});