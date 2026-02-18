import { createNodeApiClient } from '@stagewise/api-client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '../logger';

export const API_URL = process.env.API_URL || 'https://v1.api.stagewise.io';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || '';

/**
 * Creates a Supabase client for the Electron main process.
 *
 * Uses a custom storage adapter that persists the session as an in-memory
 * map. The actual encrypted-disk persistence is handled by AuthService
 * via onAuthStateChange, which writes session data through persisted-data.
 */
export function createSupabaseClient(logger: Logger): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    logger.error(
      '[AuthServerInterop] Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY environment variables.',
    );
  }

  // In-memory storage adapter for the Supabase client.
  // The Electron main process has no localStorage, so we use a simple Map.
  // Actual persistence is handled externally by AuthService.
  const memoryStorage = new Map<string, string>();

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      storage: {
        getItem: (key: string) => memoryStorage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memoryStorage.set(key, value);
        },
        removeItem: (key: string) => {
          memoryStorage.delete(key);
        },
      },
    },
  });
}

/**
 * Interop layer for backend API calls that require authentication.
 * After the migration to direct Supabase auth, this only handles
 * subscription queries via the tRPC API.
 */
export class AuthServerInterop {
  private logger: Logger;

  public constructor(logger: Logger) {
    this.logger = logger;
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
