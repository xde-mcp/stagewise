import keytar from 'keytar';
import { log } from '../utils/logger';

const SERVICE_NAME = 'stagewise-cli';
const ACCOUNT_NAME = 'default';

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  refreshExpiresAt?: string;
  userId?: string;
  userEmail?: string;
  hasEarlyAgentAccess?: boolean;
}

export class TokenManager {
  async getStoredToken(): Promise<TokenData | null> {
    try {
      const storedData = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);

      if (!storedData) {
        return null;
      }

      const parsed = JSON.parse(storedData);
      return parsed as TokenData;
    } catch (error) {
      log.debug(`Failed to retrieve stored token: ${error}`);
      return null;
    }
  }

  async storeToken(tokenData: TokenData): Promise<void> {
    try {
      const dataToStore = JSON.stringify(tokenData);
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, dataToStore);
      log.debug('Token stored successfully');
    } catch (error) {
      log.error(`Failed to store token: ${error}`);
      throw error;
    }
  }

  async deleteStoredToken(): Promise<void> {
    try {
      const deleted = await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
      if (deleted) {
        log.debug('Token deleted successfully');
      }
    } catch (error) {
      log.error(`Failed to delete token: ${error}`);
      throw error;
    }
  }

  async clearToken(): Promise<void> {
    return this.deleteStoredToken();
  }

  async resolveToken(cliToken?: string): Promise<string | null> {
    // Priority 1: CLI argument token
    if (cliToken) {
      log.debug('Using token from CLI argument');
      return cliToken;
    }

    // Priority 2: Stored token
    const storedToken = await this.getStoredToken();
    if (storedToken) {
      log.debug('Using stored token');
      return storedToken.accessToken;
    }

    // No token found
    return null;
  }
}

export const tokenManager = new TokenManager();
