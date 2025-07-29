import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tokenManager } from '../../../src/auth/token-manager';

// Mock keytar
vi.mock('keytar', () => ({
  default: {
    getPassword: vi.fn(),
    setPassword: vi.fn(),
    deletePassword: vi.fn(),
  },
}));

describe('tokenManager', () => {
  let keytarMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get the mocked keytar module
    keytarMock = (await import('keytar')).default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('storeToken', () => {
    it('should save token using keytar', async () => {
      keytarMock.setPassword.mockResolvedValue(undefined);

      const tokenData = {
        accessToken: 'test-token-123',
        userEmail: 'test@example.com',
      };

      await tokenManager.storeToken(tokenData);

      expect(keytarMock.setPassword).toHaveBeenCalledWith(
        'stagewise-cli',
        'default',
        JSON.stringify(tokenData),
      );
    });

    it('should store complete token data', async () => {
      keytarMock.setPassword.mockResolvedValue(undefined);

      const tokenData = {
        accessToken: 'test-token-123',
        refreshToken: 'refresh-token-456',
        userEmail: 'test@example.com',
        expiresAt: '2024-12-31T23:59:59Z',
      };

      await tokenManager.storeToken(tokenData);

      const savedData = keytarMock.setPassword.mock.calls[0][2];
      expect(JSON.parse(savedData)).toEqual(tokenData);
    });
  });

  describe('getStoredToken', () => {
    it('should retrieve and parse stored token', async () => {
      const tokenData = {
        accessToken: 'test-token-123',
        userEmail: 'test@example.com',
      };

      keytarMock.getPassword.mockResolvedValue(JSON.stringify(tokenData));

      const result = await tokenManager.getStoredToken();

      expect(result).toEqual(tokenData);
    });

    it('should return null when no token exists', async () => {
      keytarMock.getPassword.mockResolvedValue(null);

      const result = await tokenManager.getStoredToken();

      expect(result).toBeNull();
    });

    it('should return null when token is invalid JSON', async () => {
      keytarMock.getPassword.mockResolvedValue('invalid-json');

      const result = await tokenManager.getStoredToken();

      expect(result).toBeNull();
    });
  });

  describe('deleteStoredToken', () => {
    it('should delete token using keytar', async () => {
      keytarMock.deletePassword.mockResolvedValue(true);

      await tokenManager.deleteStoredToken();

      expect(keytarMock.deletePassword).toHaveBeenCalledWith(
        'stagewise-cli',
        'default',
      );
    });
  });

  describe('resolveToken', () => {
    it('should prioritize CLI token over stored token', async () => {
      const storedToken = {
        accessToken: 'stored-token',
        userEmail: 'stored@example.com',
      };

      keytarMock.getPassword.mockResolvedValue(JSON.stringify(storedToken));

      const result = await tokenManager.resolveToken('cli-token');

      expect(result).toBe('cli-token');
      expect(keytarMock.getPassword).not.toHaveBeenCalled();
    });

    it('should return stored token when no CLI token provided', async () => {
      const storedToken = {
        accessToken: 'stored-token',
        userEmail: 'stored@example.com',
      };

      keytarMock.getPassword.mockResolvedValue(JSON.stringify(storedToken));

      const result = await tokenManager.resolveToken();

      expect(result).toBe('stored-token');
    });

    it('should return null when no tokens available', async () => {
      keytarMock.getPassword.mockResolvedValue(null);

      const result = await tokenManager.resolveToken();

      expect(result).toBeNull();
    });
  });
});
