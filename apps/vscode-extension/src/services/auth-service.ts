import * as vscode from 'vscode';
import axios, { type AxiosRequestConfig } from 'axios';
import { StorageService } from './storage-service';
import { VScodeContext } from './vscode-context';
import { STAGEWISE_CONSOLE_URL } from '../constants';
import { getCurrentIDE } from 'src/utils/get-current-ide';

interface AuthCode {
  authCode: string;
  expiresAt: string;
  timestamp: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // Access token expiry (1 hour)
  refreshExpiresAt: string; // Refresh token expiry (30 days)
}

interface AuthState {
  isAuthenticated: boolean;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  userEmail?: string;
  expiresAt?: string; // Access token expiry
  refreshExpiresAt?: string; // Refresh token expiry
  hasEarlyAgentAccess?: boolean;
}

interface SessionValidationResponse {
  valid: boolean;
  userId: string;
  userEmail: string;
  extensionId: string;
  createdAt: string;
  isExpiringSoon: boolean;
  hasEarlyAgentAccess: boolean;
}

/**
 * Callback function type for authentication state changes
 * @param authState The new authentication state
 */
export type AuthStateChangeCallback = (
  authState: AuthState,
) => void | Promise<void>;

export class AuthService {
  private static instance: AuthService;
  protected storageService = StorageService.getInstance();
  protected context = VScodeContext.getInstance();
  protected readonly AUTH_TOKEN_KEY = 'stagewise.authToken';
  protected readonly AUTH_STATE_KEY = 'stagewise.authState';
  private refreshPromise: Promise<void> | null = null;
  private cachedAccessToken: string | null = null;
  private authStateChangeCallbacks: AuthStateChangeCallback[] = [];

  protected constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Handle incoming authentication URI
   */
  public async handleAuthenticationUri(uri: vscode.Uri): Promise<void> {
    try {
      // Extract authCode and expiresAt from query parameters
      const params = new URLSearchParams(uri.query);
      const authCode = params.get('authCode');
      const expiresAt = params.get('expiresAt');

      if (!authCode || !expiresAt) {
        throw new Error('Missing authentication parameters');
      }

      // Validate auth code format (basic validation for non-empty string)
      if (!authCode.trim() || authCode.length < 10) {
        throw new Error('Invalid auth code format');
      }

      // Check if user is already authenticated and clear old tokens
      const existingAuthState = await this.getAuthState();
      if (existingAuthState?.isAuthenticated) {
        // Revoke old tokens on server
        try {
          const body: { refreshToken?: string; token?: string } = {};
          if (existingAuthState.refreshToken) {
            body.refreshToken = existingAuthState.refreshToken;
          } else if (existingAuthState.accessToken) {
            body.token = existingAuthState.accessToken;
          }

          if (body.refreshToken || body.token) {
            await axios.post(
              `${STAGEWISE_CONSOLE_URL}/auth/extension/revoke`,
              body,
              {
                headers: {
                  'Content-Type': 'application/json',
                },
                timeout: 10000,
              },
            );
          }
        } catch (error) {
          console.warn('Failed to revoke old tokens:', error);
        }

        // Clear cached access token
        this.cachedAccessToken = null;

        // Clear stored authentication state
        await this.storageService.delete(this.AUTH_STATE_KEY);
      }

      // Store auth code temporarily
      const authCodeData: AuthCode = {
        authCode,
        expiresAt,
        timestamp: Date.now(),
      };

      // Store in secret storage for sensitive data
      const secrets = this.context.getContext()?.secrets;
      if (secrets) {
        await secrets.store(this.AUTH_TOKEN_KEY, JSON.stringify(authCodeData));
      }

      // Exchange auth code for token pair
      await this.exchangeAuthCode(authCode);
    } catch (error) {
      console.error('Authentication failed:', error);
      await vscode.window
        .showErrorMessage(
          `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
          'Retry',
        )
        .then(async (selection) => {
          if (selection === 'Retry') {
            await this.authenticate();
          }
        });
    }
  }

  /**
   * Exchange auth code for access and refresh token pair
   */
  protected async exchangeAuthCode(authCode: string): Promise<void> {
    try {
      const response = await axios.post(
        `${STAGEWISE_CONSOLE_URL}/auth/extension/exchange`,
        {
          authCode,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        },
      );

      if (response.status !== 200) {
        throw new Error(response.data.error || 'Failed to exchange auth code');
      }

      const sessionResponse = await axios.get(
        `${STAGEWISE_CONSOLE_URL}/auth/extension/session`,
        {
          headers: {
            Authorization: `Bearer ${response.data.accessToken}`,
          },
          timeout: 30000,
        },
      );

      if (sessionResponse.status !== 200) {
        throw new Error(sessionResponse.data.error || 'Failed to get session');
      }

      const sessionData: SessionValidationResponse = sessionResponse.data;

      const tokenPair: TokenPair = response.data;

      // Store authentication state
      const authState: AuthState = {
        isAuthenticated: true,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresAt: tokenPair.expiresAt,
        refreshExpiresAt: tokenPair.refreshExpiresAt,
        userId: sessionData.userId,
        userEmail: sessionData.userEmail,
        hasEarlyAgentAccess: sessionData.hasEarlyAgentAccess,
      };

      await this.storageService.set(this.AUTH_STATE_KEY, authState);

      // Update cached access token
      this.cachedAccessToken = tokenPair.accessToken;

      // Clear the temporary auth code from secrets
      const secrets = this.context.getContext()?.secrets;
      if (secrets) {
        await secrets.delete(this.AUTH_TOKEN_KEY);
      }

      // Notify callbacks of authentication state change
      await this.notifyAuthStateChange(authState);

      await vscode.window.showInformationMessage(
        'Successfully authenticated with stagewise!',
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 400) {
          throw new Error('Invalid or expired auth code');
        } else if (error.response?.status === 500) {
          throw new Error('Failed to exchange auth code');
        } else if (error.code === 'ECONNABORTED') {
          throw new Error(
            'Connection timeout - please check your internet connection',
          );
        } else if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshTokens(): Promise<void> {
    const authState = await this.getAuthState();

    if (!authState?.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Check if refresh token is expired
    if (
      authState.refreshExpiresAt &&
      new Date(authState.refreshExpiresAt) <= new Date()
    ) {
      // Refresh token is expired, user needs to re-authenticate
      await this.logout();
      await this.authenticate();
      return;
    }

    try {
      const response = await axios.post(
        `${STAGEWISE_CONSOLE_URL}/auth/extension/refresh`,
        {
          refreshToken: authState.refreshToken,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      if (response.status !== 200) {
        throw new Error(response.data.error || 'Failed to refresh tokens');
      }

      const sessionResponse = await axios.get(
        `${STAGEWISE_CONSOLE_URL}/auth/extension/session`,
        {
          headers: {
            Authorization: `Bearer ${response.data.accessToken}`,
          },
          timeout: 30000,
        },
      );

      if (sessionResponse.status !== 200) {
        throw new Error(sessionResponse.data.error || 'Failed to get session');
      }

      const _sessionData: SessionValidationResponse = sessionResponse.data;

      const tokenPair: TokenPair = response.data;

      // Update auth state with new tokens
      const updatedAuthState: AuthState = {
        ...authState,
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresAt: tokenPair.expiresAt,
        refreshExpiresAt: tokenPair.refreshExpiresAt,
      };

      await this.storageService.set(this.AUTH_STATE_KEY, updatedAuthState);

      // Update cached access token
      this.cachedAccessToken = tokenPair.accessToken;

      // Notify callbacks of authentication state change
      await this.notifyAuthStateChange(updatedAuthState);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 400) {
          throw new Error('Refresh token is required');
        } else if (error.response?.status === 401) {
          // Refresh token is invalid or expired, user needs to re-authenticate
          await this.logout();
          const errorMessage =
            error.response?.data?.error || 'Invalid refresh token';
          throw new Error(`${errorMessage}. Please authenticate again.`);
        } else if (error.response?.status === 500) {
          throw new Error('Failed to refresh tokens');
        } else if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }
      }
      throw error;
    }
  }

  /**
   * Check if access token is expired or expiring soon
   */
  private isAccessTokenExpired(expiresAt: string): boolean {
    const expiryTime = new Date(expiresAt);
    const now = new Date();
    // Consider token expired if it expires within 2 minutes (buffer)
    const bufferTime = 2 * 60 * 1000; // 2 minutes in milliseconds
    return expiryTime.getTime() - now.getTime() <= bufferTime;
  }

  /**
   * Ensure we have a valid access token, refreshing if necessary
   */
  public async ensureValidAccessToken(): Promise<string> {
    // If there's already a refresh in progress, wait for it
    if (this.refreshPromise) {
      await this.refreshPromise;
      this.refreshPromise = null;
    }

    const authState = await this.getAuthState();

    if (!authState?.isAuthenticated || !authState.accessToken) {
      throw new Error('Not authenticated');
    }

    // Check if access token is expired or expiring soon
    if (authState.expiresAt && this.isAccessTokenExpired(authState.expiresAt)) {
      // Start refresh process
      this.refreshPromise = this.refreshTokens();
      await this.refreshPromise;
      this.refreshPromise = null;

      // Get updated auth state after refresh
      const updatedAuthState = await this.getAuthState();
      if (!updatedAuthState?.accessToken) {
        throw new Error('Failed to refresh access token');
      }
      return updatedAuthState.accessToken;
    }

    return authState.accessToken;
  }

  /**
   * Manual authentication trigger
   */
  public async authenticate(): Promise<void> {
    const authUrl = `${STAGEWISE_CONSOLE_URL}/authenticate-ide?ide=${getCurrentIDE().toLowerCase()}`;
    await vscode.env.openExternal(vscode.Uri.parse(authUrl));
    await vscode.window.showInformationMessage(
      'Please complete authentication in your browser. The extension will be authenticated automatically.',
    );
  }

  /**
   * Logout from stagewise
   */
  public async logout(): Promise<void> {
    const authState = await this.getAuthState();

    // Try to revoke tokens on server side first
    if (authState?.refreshToken || authState?.accessToken) {
      try {
        // Build request body - prefer refresh token as it revokes both tokens
        const body: { refreshToken?: string; token?: string } = {};
        if (authState.refreshToken) {
          body.refreshToken = authState.refreshToken;
        } else if (authState.accessToken) {
          body.token = authState.accessToken;
        }

        await axios.post(
          `${STAGEWISE_CONSOLE_URL}/auth/extension/revoke`,
          body,
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 10000, // 10 second timeout for logout
          },
        );
      } catch (error) {
        // Don't fail logout if revoke fails (network issues, etc.)
        console.warn('Failed to revoke tokens on server:', error);
      }
    }

    // Clear stored authentication
    await this.storageService.delete(this.AUTH_STATE_KEY);

    // Clear cached access token
    this.cachedAccessToken = null;

    const secrets = this.context.getContext()?.secrets;
    if (secrets) {
      await secrets.delete(this.AUTH_TOKEN_KEY);
    }

    // Notify callbacks of authentication state change (logged out)
    await this.notifyAuthStateChange({ isAuthenticated: false });

    await vscode.window.showInformationMessage(
      'Successfully logged out from stagewise',
    );
  }

  /**
   * Check authentication status
   */
  public async checkAuthStatus(): Promise<AuthState> {
    const authState = await this.storageService.get<AuthState>(
      this.AUTH_STATE_KEY,
    );

    // If no local auth state, user is not authenticated
    if (!authState?.isAuthenticated || !authState.accessToken) {
      await vscode.window.showInformationMessage(
        'Not authenticated. Use "stagewise: Authenticate" command to login.',
      );
      return { isAuthenticated: false };
    }

    try {
      // Ensure we have a valid access token (will refresh if needed)
      const accessToken = await this.ensureValidAccessToken();

      // Validate session with backend
      const response = await axios.get(
        `${STAGEWISE_CONSOLE_URL}/auth/extension/session`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 30000,
        },
      );

      if (response.status === 200) {
        const sessionData: SessionValidationResponse = response.data;

        if (sessionData.valid) {
          // Update auth state with latest information
          const updatedAuthState: AuthState = {
            ...authState,
            userId: sessionData.userId,
            userEmail: sessionData.userEmail,
            hasEarlyAgentAccess: sessionData.hasEarlyAgentAccess,
          };

          if (JSON.stringify(updatedAuthState) !== JSON.stringify(authState)) {
            await this.storageService.set(
              this.AUTH_STATE_KEY,
              updatedAuthState,
            );

            // Notify callbacks of authentication state change
            await this.notifyAuthStateChange(updatedAuthState);
          }

          await vscode.window.showInformationMessage(
            `Authenticated as: ${updatedAuthState.userEmail} - Early Agent Access: ${updatedAuthState.hasEarlyAgentAccess}`,
          );

          return updatedAuthState;
        } else {
          // Session is invalid, clear auth state
          await this.logout();
          await vscode.window.showInformationMessage(
            'Session expired. Please authenticate again.',
          );
          return { isAuthenticated: false };
        }
      } else {
        throw new Error('Failed to validate session');
      }
    } catch (error) {
      // Handle network errors or other issues
      if (
        error instanceof Error &&
        (error.message.includes('authenticate again') ||
          error.message.includes('Refresh token'))
      ) {
        // Already handled by token refresh logic
        await vscode.window.showInformationMessage(
          'Session expired. Please authenticate again.',
        );
        return { isAuthenticated: false };
      }

      // For other errors (network issues, etc.), assume still authenticated but show warning
      console.warn('Failed to validate session:', error);
      await vscode.window.showWarningMessage(
        'Unable to verify authentication status. Please check your connection.',
      );
      return authState;
    }
  }

  /**
   * Get current authentication state
   */
  public async getAuthState(): Promise<AuthState | null> {
    const state = await this.storageService.get<AuthState>(this.AUTH_STATE_KEY);
    return state || null;
  }

  /**
   * Get the currently saved access token immediately (without refresh)
   */
  public async getAccessToken(): Promise<string | null> {
    // Return cached token if available
    if (this.cachedAccessToken) {
      return this.cachedAccessToken;
    }

    // Load from storage for the first time and cache it
    const authState = await this.getAuthState();
    if (authState?.accessToken) {
      this.cachedAccessToken = authState.accessToken;
      return this.cachedAccessToken;
    }

    return null;
  }

  /**
   * Get authorization headers for API calls
   */
  public async getAuthHeaders(): Promise<Record<string, string>> {
    const accessToken = await this.ensureValidAccessToken();

    return {
      Authorization: `Bearer ${accessToken}`,
    };
  }

  /**
   * Make an authenticated API request with automatic token refresh
   * @param config Axios request configuration
   * @returns Axios response
   */
  public async makeAuthenticatedRequest<T = any>(
    config: AxiosRequestConfig,
  ): Promise<T> {
    try {
      const authHeaders = await this.getAuthHeaders();

      const authenticatedConfig = {
        ...config,
        headers: {
          ...config.headers,
          ...authHeaders,
        },
      };

      const response = await axios(authenticatedConfig);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Access token might be expired, try to refresh and retry once
        try {
          await this.refreshTokens();

          // Retry the request with new token
          const authHeaders = await this.getAuthHeaders();
          const authenticatedConfig = {
            ...config,
            headers: {
              ...config.headers,
              ...authHeaders,
            },
          };

          const response = await axios(authenticatedConfig);
          return response.data;
        } catch (_refreshError) {
          // Refresh failed, user needs to re-authenticate
          await this.logout();
          throw new Error('Authentication expired. Please login again.');
        }
      }
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  public async isAuthenticated(): Promise<boolean> {
    const authState = await this.getAuthState();
    if (!authState?.isAuthenticated || !authState.accessToken) {
      return false;
    }

    // Check if refresh token is expired
    if (
      authState.refreshExpiresAt &&
      new Date(authState.refreshExpiresAt) <= new Date()
    ) {
      await this.logout();
      return false;
    }

    return true;
  }

  /**
   * Check if the authenticated user has early agent access
   */
  public async hasEarlyAgentAccess(): Promise<boolean> {
    const authState = await this.getAuthState();
    return authState?.hasEarlyAgentAccess ?? false;
  }

  /**
   * Revoke a specific token
   */
  public async revokeToken(
    token?: string,
    refreshToken?: string,
  ): Promise<void> {
    if (!token && !refreshToken) {
      throw new Error('Either token or refreshToken must be provided');
    }

    const body = refreshToken ? { refreshToken } : { token };

    // For token revocation, we don't need authentication - the token itself is the credential
    await axios.post(`${STAGEWISE_CONSOLE_URL}/auth/extension/revoke`, body, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  /**
   * Register a callback to be notified when authentication state changes.
   * This will be called whenever the user logs in, logs out, tokens are refreshed,
   * or user information is updated.
   *
   * @param callback Function to call when auth state changes
   * @returns Unsubscribe function to remove the callback
   *
   * @example
   * ```typescript
   * const authService = AuthService.getInstance();
   * const unsubscribe = authService.onAuthStateChanged((authState) => {
   *   if (authState.isAuthenticated) {
   *     console.log('User logged in:', authState.userEmail);
   *   } else {
   *     console.log('User logged out');
   *   }
   * });
   *
   * // Later, when you want to stop listening:
   * unsubscribe();
   * ```
   */
  public onAuthStateChanged(callback: AuthStateChangeCallback): () => void {
    this.authStateChangeCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.authStateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.authStateChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all registered callbacks of authentication state changes
   */
  private async notifyAuthStateChange(authState: AuthState): Promise<void> {
    for (const callback of this.authStateChangeCallbacks) {
      try {
        await callback(authState);
      } catch (error) {
        console.error('Error in auth state change callback:', error);
      }
    }
  }
}
