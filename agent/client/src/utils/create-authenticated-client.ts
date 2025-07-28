import { createNodeApiClient, type TRPCClient } from '@stagewise/api-client';
import type { AppRouter } from '@stagewise/api-client';

export function createAuthenticatedClient(
  accessToken: string | null,
): TRPCClient<AppRouter> {
  try {
    const headers = accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : ({} as Record<string, string>);

    return createNodeApiClient({
      fetch: fetch,
      headers,
    });
  } catch (error) {
    console.error(
      '[createAuthenticatedClient]: Error creating authenticated client',
      error,
    );
    throw error;
  }
}
