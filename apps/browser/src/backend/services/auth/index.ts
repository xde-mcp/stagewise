import type { KartonContract } from '@shared/karton-contracts/ui';
import type { KartonService } from '../karton';
import type { Logger } from '../logger';
import { AuthServerInterop, createSupabaseClient } from './server-interop';
import type { NotificationService } from '../notification';
import type { IdentifierService } from '../identifier';
import { DisposableService } from '../disposable';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  readPersistedData,
  writePersistedData,
} from '../../utils/persisted-data';
import {
  validateApiKeys,
  type ApiKeysInput,
} from '../../utils/validate-api-keys';

const CREDENTIALS_KEY = 'credentials';

const sessionSchema = z
  .object({
    access_token: z.string(),
    refresh_token: z.string(),
    expires_at: z.number().optional(),
    user: z
      .object({
        id: z.string(),
        email: z.string().optional(),
      })
      .optional(),
  })
  .nullable();

export type AuthState = KartonContract['state']['userAccount'];

export class AuthService extends DisposableService {
  private readonly identifierService: IdentifierService;
  private readonly uiKarton: KartonService;
  private readonly notificationService: NotificationService;
  private readonly logger: Logger;

  private _sessionJson: string | null = null;
  private serverInterop: AuthServerInterop;
  private supabase!: SupabaseClient;

  private _authStateCheckInterval: NodeJS.Timeout | null = null;
  private authChangeCallbacks: ((newAuthState: AuthState) => void)[] = [];

  private constructor(
    identifierService: IdentifierService,
    uiKarton: KartonService,
    notificationService: NotificationService,
    logger: Logger,
  ) {
    super();
    this.identifierService = identifierService;
    this.uiKarton = uiKarton;
    this.notificationService = notificationService;
    this.logger = logger;
    this.serverInterop = new AuthServerInterop(logger);
  }

  private persistSession(value: string | null): void {
    this._sessionJson = value;
    const parsed = value ? JSON.parse(value) : null;
    void writePersistedData(CREDENTIALS_KEY, sessionSchema, parsed, {
      encrypt: true,
    });
  }

  private async initialize(): Promise<void> {
    const persisted = await readPersistedData(
      CREDENTIALS_KEY,
      sessionSchema,
      null,
      { encrypt: true },
    );
    if (persisted) {
      this._sessionJson = JSON.stringify(persisted);
    }

    // Create the Supabase client
    this.supabase = createSupabaseClient(this.logger);

    // Restore persisted session into the Supabase client's in-memory storage
    const storedSession = this._sessionJson;
    if (storedSession) {
      // The Supabase client reads from its storage adapter on getSession(),
      // so we need to seed the in-memory storage before calling it.
      // We do this by setting the session directly.
      try {
        const parsed = JSON.parse(storedSession);
        if (parsed?.access_token && parsed?.refresh_token) {
          await this.supabase.auth.setSession({
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token,
          });
          this.logger.debug(
            '[AuthService] Restored persisted Supabase session',
          );
        }
      } catch (err) {
        this.logger.warn(
          `[AuthService] Failed to restore persisted session: ${err}`,
        );
      }
    }

    this.uiKarton.setState((draft) => {
      draft.userAccount.status = 'server_unreachable';
    });

    // Listen for Supabase auth state changes (handles auto-refresh)
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.logger.debug(`[AuthService] Supabase auth state change: ${event}`);

      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'INITIAL_SESSION'
      ) {
        if (session) {
          // Persist the session to disk
          this.persistSession(
            JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_at: session.expires_at,
              user: session.user
                ? { id: session.user.id, email: session.user.email }
                : undefined,
            }),
          );

          // Update Karton state
          this.updateAuthState((draft) => {
            draft.userAccount = {
              ...draft.userAccount,
              status: 'authenticated',
              machineId: this.identifierService.getMachineId(),
              user: session.user
                ? {
                    id: session.user.id,
                    email: session.user.email ?? '',
                  }
                : undefined,
            };
          });

          // Fetch subscription in the background
          if (event !== 'TOKEN_REFRESHED') {
            void this.fetchSubscription(session.access_token);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        this.persistSession(null);
        this.updateAuthState((draft) => {
          draft.userAccount = {
            status: 'unauthenticated',
            machineId: this.identifierService.getMachineId(),
          };
        });
      }
    });

    // Initial auth state check
    void this.checkAuthState();
    this._authStateCheckInterval = setInterval(
      () => {
        void this.checkAuthState();
      },
      10 * 60 * 1000,
    );

    // Register procedure handlers
    this.uiKarton.registerServerProcedureHandler(
      'userAccount.sendOtp',
      async (_callingClientId: string, email: string) => {
        return this.sendOtp(email);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.verifyOtp',
      async (_callingClientId: string, email: string, code: string) => {
        return this.verifyOtp(email, code);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.logout',
      async (_callingClientId: string) => {
        await this.logout();
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.refreshStatus',
      async (_callingClientId: string) => {
        await this.checkAuthState();
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'userAccount.validateApiKeys',
      async (_callingClientId: string, keys: ApiKeysInput) => {
        this.logger.debug('[AuthService] Validating API keys');
        return validateApiKeys(keys);
      },
    );

    this.logger.debug('[AuthService] Initialized');
  }

  public static async create(
    identifierService: IdentifierService,
    uiKarton: KartonService,
    notificationService: NotificationService,
    logger: Logger,
  ): Promise<AuthService> {
    const authService = new AuthService(
      identifierService,
      uiKarton,
      notificationService,
      logger,
    );
    await authService.initialize();
    return authService;
  }

  protected onTeardown(): void {
    clearInterval(this._authStateCheckInterval!);

    this.uiKarton.removeServerProcedureHandler('userAccount.sendOtp');
    this.uiKarton.removeServerProcedureHandler('userAccount.verifyOtp');
    this.uiKarton.removeServerProcedureHandler('userAccount.logout');
    this.uiKarton.removeServerProcedureHandler('userAccount.refreshStatus');
    this.uiKarton.removeServerProcedureHandler('userAccount.validateApiKeys');
    this.authChangeCallbacks = [];

    this.logger.debug('[AuthService] Teardown complete');
  }

  /**
   * Send an OTP code to the given email address.
   */
  public async sendOtp(email: string): Promise<{ error?: string }> {
    try {
      const { error } = await this.supabase.auth.signInWithOtp({ email });
      if (error) {
        this.logger.error(`[AuthService] Failed to send OTP: ${error.message}`);
        return { error: error.message };
      }
      this.logger.debug(`[AuthService] OTP sent to ${email}`);
      return {};
    } catch (err) {
      this.logger.error(`[AuthService] Unexpected error sending OTP: ${err}`);
      return { error: 'An unexpected error occurred.' };
    }
  }

  /**
   * Verify an OTP code for the given email address.
   * On success, the Supabase client will fire onAuthStateChange with SIGNED_IN.
   */
  public async verifyOtp(
    email: string,
    code: string,
  ): Promise<{ error?: string }> {
    try {
      const { data, error } = await this.supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });

      if (error) {
        this.logger.error(
          `[AuthService] Failed to verify OTP: ${error.message}`,
        );
        return { error: error.message };
      }

      if (data.session) {
        this.logger.debug('[AuthService] OTP verified, session established');
        return {};
      }

      return { error: 'Verification completed but no session was created.' };
    } catch (err) {
      this.logger.error(`[AuthService] Unexpected error verifying OTP: ${err}`);
      return { error: 'An unexpected error occurred.' };
    }
  }

  /**
   * Check the current auth state by querying the Supabase session.
   */
  private async checkAuthState(): Promise<void> {
    try {
      const {
        data: { session },
      } = await this.supabase.auth.getSession();

      if (!session) {
        this.updateAuthState((draft) => {
          draft.userAccount = {
            status: 'unauthenticated',
            machineId: this.identifierService.getMachineId(),
          };
        });
        return;
      }

      this.updateAuthState((draft) => {
        draft.userAccount = {
          ...draft.userAccount,
          status: 'authenticated',
          machineId: this.identifierService.getMachineId(),
          user: session.user
            ? {
                id: session.user.id,
                email: session.user.email ?? '',
              }
            : undefined,
        };
      });

      // Fetch subscription data
      await this.fetchSubscription(session.access_token);
    } catch (err) {
      this.updateAuthState((draft) => {
        draft.userAccount.status = 'server_unreachable';
      });
      this.logger.error(`[AuthService] Failed to check auth state: ${err}`);
    }
  }

  /**
   * Fetch subscription info and update Karton state.
   */
  private async fetchSubscription(accessToken: string): Promise<void> {
    const subscriptionData =
      await this.serverInterop.getSubscription(accessToken);

    if (subscriptionData) {
      this.updateAuthState((draft) => {
        draft.userAccount = {
          ...draft.userAccount,
          subscription: {
            active: subscriptionData.hasSubscription || false,
            plan: subscriptionData.subscription?.priceId || undefined,
            expiresAt:
              subscriptionData.subscription?.currentPeriodEnd?.toISOString() ||
              undefined,
          },
        };
      });
    }
  }

  public async logout(): Promise<void> {
    await this.supabase.auth.signOut();
    this.persistSession(null);

    this.notificationService.showNotification({
      title: 'Logged out',
      message: 'You have been logged out of stagewise.',
      type: 'info',
      duration: 5000,
      actions: [],
    });

    this.logger.debug('[AuthService] Logged out');
  }

  public get authState(): AuthState {
    this.assertNotDisposed();
    return this.uiKarton.state.userAccount;
  }

  public get accessToken(): string | undefined {
    this.assertNotDisposed();
    if (!this._sessionJson) return undefined;
    try {
      const parsed = JSON.parse(this._sessionJson);
      return parsed?.access_token;
    } catch {
      return undefined;
    }
  }

  public async refreshAuthState(): Promise<AuthState> {
    await this.checkAuthState();
    return this.authState;
  }

  private updateAuthState(
    draft: Parameters<typeof this.uiKarton.setState>[0],
  ): void {
    const oldState = structuredClone(this.uiKarton.state.userAccount);
    this.uiKarton.setState(draft);
    const newState = this.uiKarton.state.userAccount;
    if (JSON.stringify(oldState) !== JSON.stringify(newState)) {
      for (const callback of this.authChangeCallbacks) {
        try {
          callback(newState);
        } catch {
          // NO-OP
        }
      }
    }
  }

  public registerAuthStateChangeCallback(
    callback: (newAuthState: AuthState) => void,
  ): void {
    this.authChangeCallbacks.push(callback);
  }

  public unregisterAuthStateChangeCallback(
    callback: (newAuthState: AuthState) => void,
  ): void {
    this.authChangeCallbacks = this.authChangeCallbacks.filter(
      (c) => c !== callback,
    );
  }
}
