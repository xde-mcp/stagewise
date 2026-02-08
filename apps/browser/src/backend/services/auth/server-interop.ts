import { createNodeApiClient } from '@stagewise/api-client';
import type { Logger } from '../logger';
import { z } from 'zod';

export const consoleUrl =
  process.env.STAGEWISE_CONSOLE_URL || 'https://console.stagewise.io';

export const API_URL = process.env.API_URL || 'https://v1.api.stagewise.io';

const SessionResponseSchema = z.looseObject({
  valid: z.boolean(),
  userId: z.string(),
  userEmail: z.email(),
  extensionId: z.string(),
  createdAt: z.iso.datetime(),
  isExpiringSoon: z.boolean(),
});

const tokenDataResponseSchema = z.looseObject({
  accessToken: z.string(),
  expiresAt: z.iso.datetime(),
  refreshToken: z.string(),
  refreshExpiresAt: z.iso.datetime(),
});

type SessionResponse = z.infer<typeof SessionResponseSchema>;
type TokenDataResponse = z.infer<typeof tokenDataResponseSchema>;

export class AuthServerInterop {
  private logger: Logger;

  public constructor(logger: Logger) {
    this.logger = logger;
  }

  public async getSession(
    accessToken: string,
  ): Promise<SessionResponse | null> {
    const sessionUrl = `${consoleUrl}/auth/extension/session`;

    const response = await fetch(sessionUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(30000), // Wait for 30 seconds maximum to get the session
    });

    if (!response.ok) {
      this.logger.error(
        `[AuthServerInterop] Failed to get session: ${response.statusText}`,
      );
      throw new Error(`Failed to get session: ${response.statusText}`);
    }
    try {
      const sessionResponse = SessionResponseSchema.parse(
        await response.json(),
      );
      return sessionResponse;
    } catch (err) {
      this.logger.error(
        `[AuthServerInterop] Failed to parse session response: ${err}`,
      );
      throw new Error(`Failed to parse session response: ${err}`);
    }
  }

  public async refreshToken(refreshToken: string): Promise<TokenDataResponse> {
    const refreshTokenFetchUrl = `${consoleUrl}/auth/extension/refresh`;
    const result = await fetch(refreshTokenFetchUrl, {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000), // Wait for 30 seconds maximum to refresh the token
    }).catch((err) => {
      this.logger.error(`[AuthServerInterop] Failed to refresh token: ${err}`);
      throw err;
    });

    if (!result || !result.ok) {
      this.logger.error(
        `[AuthServerInterop] Failed to refresh token: ${result?.statusText}`,
      );
      throw new Error(`Failed to refresh token: ${result?.statusText}`);
    }
    try {
      const jsonData = await result.json();
      this.logger.debug(
        `[AuthServerInterop] Refresh token response: ${JSON.stringify(jsonData)}`,
      );
      const tokenData = tokenDataResponseSchema.parse(jsonData);
      return tokenData;
    } catch (err) {
      this.logger.error(
        `[AuthServerInterop] Failed to parse refresh token response: ${err}`,
      );
      throw err;
    }
  }

  public async revokeToken(token: string): Promise<void> {
    const revokeTokenFetchUrl = `${consoleUrl}/auth/extension/revoke`;
    const response = await fetch(revokeTokenFetchUrl, {
      method: 'POST',
      body: JSON.stringify({ token }),
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000), // Wait for 30 seconds maximum to revoke the token
    });
    if (!response.ok) {
      this.logger.error(
        `[AuthServerInterop] Failed to revoke token: ${response.statusText}`,
      );
      throw new Error(`Failed to revoke token: ${response.statusText}`);
    }
  }

  public async exchangeToken(authCode: string): Promise<TokenDataResponse> {
    const exchangeTokenFetchUrl = `${consoleUrl}/auth/extension/exchange`;
    const result = await fetch(exchangeTokenFetchUrl, {
      method: 'POST',
      body: JSON.stringify({ authCode }),
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000), // Wait for 30 seconds maximum to exchange the token
    });

    if (!result || !result.ok) {
      this.logger.error(
        `[AuthServerInterop] Failed to exchange token: ${result?.statusText}`,
      );
      throw new Error(`Failed to exchange token: ${result?.statusText}`);
    }
    try {
      const jsonData = await result.json();
      this.logger.debug(
        `[AuthServerInterop] Exchange token response: ${JSON.stringify(jsonData)}`,
      );
      const tokenData = tokenDataResponseSchema.parse(jsonData);
      return tokenData;
    } catch (err) {
      this.logger.error(
        `[AuthServerInterop] Failed to parse exchange token response: ${err}`,
      );
      throw err;
    }
  }

  public async getSubscription(accessToken: string) {
    const client = createNodeApiClient({
      baseUrl: API_URL,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // The tRPC client uses httpBatchStreamLink (streaming HTTP) which has
    // no built-in timeout. If the server responds with headers but the
    // stream body never closes, the query hangs indefinitely. We add an
    // explicit timeout to prevent this from blocking the auth flow.
    const SUBSCRIPTION_TIMEOUT_MS = 15_000;
    const subscriptionData = await Promise.race([
      client.subscription.getSubscription.query(),
      new Promise<null>((_, reject) =>
        setTimeout(
          () => reject(new Error('Subscription query timed out')),
          SUBSCRIPTION_TIMEOUT_MS,
        ),
      ),
    ]).catch((err) => {
      this.logger.error(
        `[AuthServerInterop] Failed to get subscription: ${err}`,
      );
      return null;
    });

    this.logger.debug(
      `[AuthServerInterop] Subscription data: ${JSON.stringify(subscriptionData)}`,
    );

    return subscriptionData;
  }
}
