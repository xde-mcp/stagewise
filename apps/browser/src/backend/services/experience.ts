/**
 * The experience state service is responsible for managing the state of the global user experience.
 *
 * This includes preferences for what's shown in UI, the progress of getting started experiences etc.
 *
 * @warning The state of worksapce-specific experiences is to be managed by the workspace manager etc.
 */

import {
  recentlyOpenedWorkspacesArraySchema,
  onboardingStateSchema,
  lastViewedChatsSchema,
  type StoredExperienceData,
  type RecentlyOpenedWorkspace,
  type InspirationWebsite,
} from '@shared/karton-contracts/ui';
import type { KartonService } from './karton';
import type { Logger } from './logger';
import type { GlobalDataPathService } from './global-data-path';
import type { PagesService } from './pages';
import {
  type AppRouter,
  createNodeApiClient,
  type TRPCClient,
} from '@stagewise/api-client';
import { API_URL } from './auth/server-interop';
import { DisposableService } from './disposable';
import { readPersistedData, writePersistedData } from '../utils/persisted-data';
import type { TelemetryService } from './telemetry';

export class UserExperienceService extends DisposableService {
  private readonly logger: Logger;
  private readonly uiKarton: KartonService;
  private readonly globalDataPathService: GlobalDataPathService;
  private readonly telemetryService: TelemetryService;
  private pagesService?: PagesService;
  private inspirationSeed = crypto.randomUUID();
  private cachedInspirationWebsites: InspirationWebsite = {
    websites: [],
    total: 0,
    seed: '',
  };
  private inspirationFetchInProgress: Promise<InspirationWebsite> | null = null;

  private unAuthenticatedApiClient: TRPCClient<AppRouter> = createNodeApiClient(
    {
      baseUrl: API_URL,
    },
  );

  // Store bound callback reference for proper unregistration
  private readonly boundHandleServiceStateChange: () => void;

  // Track last synced storedExperienceData to prevent infinite loops
  private lastSyncedStoredExperienceData: string | null = null;

  // Serialize markChatAsViewed calls to prevent read-modify-write race conditions.
  // Without this, concurrent calls can read the same file snapshot, each add their
  // own entry to a local copy, then the second write overwrites the first's additions.
  private markChatAsViewedQueue: Promise<void> = Promise.resolve();

  // Flag to prevent re-entrant initialization
  private isLoadingStoredExperienceData = false;
  private hasInitializedStoredExperienceData = false;

  private constructor(
    logger: Logger,
    uiKarton: KartonService,
    globalDataPathService: GlobalDataPathService,
    telemetryService: TelemetryService,
  ) {
    super();
    this.logger = logger;
    this.uiKarton = uiKarton;
    this.globalDataPathService = globalDataPathService;
    this.telemetryService = telemetryService;

    // Bind once and store reference for later unregistration
    this.boundHandleServiceStateChange =
      this.handleServiceStateChange.bind(this);
  }

  private report(
    error: Error,
    operation: string,
    extra?: Record<string, unknown>,
  ) {
    this.telemetryService.captureException(error, {
      service: 'experience',
      operation,
      ...extra,
    });
  }

  public static async create(
    logger: Logger,
    uiKarton: KartonService,
    globalDataPathService: GlobalDataPathService,
    telemetryService: TelemetryService,
  ) {
    logger.debug('[UserExperienceService] Creating service');
    const instance = new UserExperienceService(
      logger,
      uiKarton,
      globalDataPathService,
      telemetryService,
    );
    await instance.initialize();
    logger.debug('[UserExperienceService] Created service');
    return instance;
  }

  private async initialize() {
    this.uiKarton.registerStateChangeCallback(
      this.boundHandleServiceStateChange,
    );

    void this.pruneRecentlyOpenedWorkspaces({
      maxAmount: 10,
      hasBeenOpenedBeforeDate: Date.now() - 1000 * 60 * 60 * 24 * 30, // 30 days ago
    });

    this.uiKarton.registerServerProcedureHandler(
      'userExperience.devAppPreview.changeScreenSize',
      async (
        _callingClientId: string,
        size: {
          width: number;
          height: number;
          presetName: string;
        } | null,
      ) => {
        this.uiKarton.setState((draft) => {
          draft.userExperience.devAppPreview.customScreenSize = size
            ? {
                width: size.width,
                height: size.height,
                presetName: size.presetName,
              }
            : null;
        });
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'userExperience.devAppPreview.toggleShowCodeMode',
      async (_callingClientId: string) => {
        this.uiKarton.setState((draft) => {
          draft.userExperience.devAppPreview.inShowCodeMode =
            !draft.userExperience.devAppPreview.inShowCodeMode;
        });
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'userExperience.devAppPreview.toggleFullScreen',
      async (_callingClientId: string) => {
        this.uiKarton.setState((draft) => {
          draft.userExperience.devAppPreview.isFullScreen =
            !draft.userExperience.devAppPreview.isFullScreen;
        });
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'userExperience.markChatAsViewed',
      async (_callingClientId: string, agentId: string) => {
        await this.markChatAsViewed(agentId);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'userExperience.setHasSeenOnboardingFlow',
      async (
        _callingClientId: string,
        value: boolean,
        suggestion?: { id: string; url: string; prompt: string },
      ) => {
        await this.setHasSeenOnboardingFlow(value, suggestion);
      },
    );
    this.uiKarton.registerServerProcedureHandler(
      'userExperience.clearPendingOnboardingSuggestion',
      async (_callingClientId: string) => {
        this.uiKarton.setState((draft) => {
          draft.userExperience.pendingOnboardingSuggestion = null;
        });
      },
    );
  }

  protected onTeardown(): void {
    this.uiKarton.unregisterStateChangeCallback(
      this.boundHandleServiceStateChange,
    );
    this.uiKarton.removeServerProcedureHandler(
      'userExperience.devAppPreview.changeScreenSize',
    );
    this.uiKarton.removeServerProcedureHandler(
      'userExperience.devAppPreview.toggleShowCodeMode',
    );
    this.uiKarton.removeServerProcedureHandler(
      'userExperience.devAppPreview.toggleFullScreen',
    );
    this.uiKarton.removeServerProcedureHandler(
      'userExperience.setHasSeenOnboardingFlow',
    );
    this.uiKarton.removeServerProcedureHandler(
      'userExperience.clearPendingOnboardingSuggestion',
    );
    this.logger.debug('[UserExperienceService] Teardown complete');
  }

  private handleServiceStateChange() {
    // Load stored experience data if needed (only once per session)
    const state = this.uiKarton.state;
    const needsInitialization =
      state.userAccount?.status === 'authenticated' &&
      !this.hasInitializedStoredExperienceData &&
      !this.isLoadingStoredExperienceData;

    if (needsInitialization) {
      // Set flag to prevent re-entrant calls
      this.isLoadingStoredExperienceData = true;

      // Load data asynchronously first
      void this.getStoredExperienceData().then((storedExperienceData) => {
        // Mark as initialized to prevent future re-loads
        this.hasInitializedStoredExperienceData = true;
        this.isLoadingStoredExperienceData = false;

        this.uiKarton.setState((draft) => {
          draft.userExperience.storedExperienceData = storedExperienceData;
        });
        // Sync to pages API
        this.syncHomePageStateToPagesService();
      });
    }

    // Only sync if not currently loading (to prevent loops)
    if (!this.isLoadingStoredExperienceData)
      this.syncHomePageStateToPagesService();
  }

  /**
   * Get inspiration websites with pagination.
   * Results are cached - will only fetch from API if we don't have enough cached data.
   */
  public async getInspirationWebsites(params: {
    offset: number;
    limit: number;
  }): Promise<InspirationWebsite> {
    const { offset, limit } = params;
    const requestedEnd = offset + limit;
    const cachedCount = this.cachedInspirationWebsites.websites.length;

    // Check if we have enough cached data
    // Note: We only check against total when we've actually fetched before (seed is set).
    // Otherwise total=0 initial state would incorrectly match cachedCount=0.
    const hasFetchedBefore = this.cachedInspirationWebsites.seed !== '';
    if (
      cachedCount >= requestedEnd ||
      (hasFetchedBefore && cachedCount >= this.cachedInspirationWebsites.total)
    ) {
      // Return slice from cache
      return {
        websites: this.cachedInspirationWebsites.websites.slice(
          offset,
          requestedEnd,
        ),
        total: this.cachedInspirationWebsites.total,
        seed: this.inspirationSeed,
      };
    }

    // Need to fetch more - deduplicate concurrent requests
    if (this.inspirationFetchInProgress) {
      await this.inspirationFetchInProgress;
      // After waiting, check cache again
      return this.getInspirationWebsites(params);
    }

    // Fetch more websites from API
    this.inspirationFetchInProgress = this.fetchMoreInspirationWebsites(
      requestedEnd - cachedCount,
    );
    try {
      await this.inspirationFetchInProgress;
    } finally {
      this.inspirationFetchInProgress = null;
    }

    // Return slice from updated cache
    return {
      websites: this.cachedInspirationWebsites.websites.slice(
        offset,
        requestedEnd,
      ),
      total: this.cachedInspirationWebsites.total,
      seed: this.inspirationSeed,
    };
  }

  /**
   * Internal method to fetch more inspiration websites from API.
   */
  private async fetchMoreInspirationWebsites(
    minCount: number,
  ): Promise<InspirationWebsite> {
    try {
      const response =
        await this.unAuthenticatedApiClient.inspiration.list.query({
          offset: this.cachedInspirationWebsites.websites.length,
          limit: Math.max(minCount, 10), // Fetch at least 10 at a time
          seed: this.inspirationSeed,
        });

      this.cachedInspirationWebsites = {
        websites: [
          ...this.cachedInspirationWebsites.websites,
          ...response.websites,
        ],
        total: response.total,
        seed: this.inspirationSeed,
      };

      this.logger.debug(
        `[UserExperienceService] Fetched ${response.websites.length} inspiration websites, total cached: ${this.cachedInspirationWebsites.websites.length}`,
      );

      return this.cachedInspirationWebsites;
    } catch (error) {
      this.logger.error(
        `[UserExperienceService] Failed to fetch inspiration websites: ${error}`,
      );
      this.report(error as Error, 'fetchInspirationWebsites');
      // Return current cache even on error
      return this.cachedInspirationWebsites;
    }
  }

  /**
   * Read the recently opened workspaces from persisted data.
   */
  private async readRecentlyOpenedWorkspaces(): Promise<
    RecentlyOpenedWorkspace[]
  > {
    return readPersistedData(
      'recently-opened-workspaces',
      recentlyOpenedWorkspacesArraySchema,
      [],
    );
  }

  /**
   * Write the recently opened workspaces to persisted data.
   */
  private async writeRecentlyOpenedWorkspaces(
    workspaces: RecentlyOpenedWorkspace[],
  ): Promise<void> {
    await writePersistedData(
      'recently-opened-workspaces',
      recentlyOpenedWorkspacesArraySchema,
      workspaces,
    );
  }

  /**
   * Read the onboarding state from persisted data.
   */
  private async readOnboardingState(): Promise<boolean> {
    const data = await readPersistedData(
      'onboarding-state',
      onboardingStateSchema,
      { hasSeenOnboardingFlow: false },
    );
    return data.hasSeenOnboardingFlow;
  }

  /**
   * Write the onboarding state to persisted data.
   */
  private async writeOnboardingState(
    hasSeenOnboardingFlow: boolean,
  ): Promise<void> {
    await writePersistedData('onboarding-state', onboardingStateSchema, {
      hasSeenOnboardingFlow,
    });
  }

  /**
   * Read the last viewed chats from persisted data.
   */
  private async readLastViewedChats(): Promise<Record<string, number>> {
    return readPersistedData('last-viewed-chats', lastViewedChatsSchema, {});
  }

  /**
   * Write the last viewed chats to persisted data.
   */
  private async writeLastViewedChats(
    lastViewedChats: Record<string, number>,
  ): Promise<void> {
    await writePersistedData(
      'last-viewed-chats',
      lastViewedChatsSchema,
      lastViewedChats,
    );
  }

  public async saveRecentlyOpenedWorkspace({
    path: workspacePath,
    name,
    openedAt,
  }: {
    path: string;
    name: string;
    openedAt: number;
  }) {
    // Load existing workspaces
    const workspaces = await this.readRecentlyOpenedWorkspaces();

    // Check if workspace with this path already exists
    const existingIndex = workspaces.findIndex(
      (ws) => ws.path === workspacePath,
    );

    const workspaceEntry: RecentlyOpenedWorkspace = {
      path: workspacePath,
      name,
      openedAt,
    };

    // Update existing entry or add new one
    if (existingIndex !== -1) {
      workspaces[existingIndex] = workspaceEntry;
    } else {
      workspaces.push(workspaceEntry);
    }

    try {
      await this.writeRecentlyOpenedWorkspaces(workspaces);
      // Update UI state with combined data
      const storedData = await this.getStoredExperienceData();
      this.uiKarton.setState((draft) => {
        draft.userExperience.storedExperienceData = storedData;
      });
      // Sync to pages API
      this.syncHomePageStateToPagesService();
      this.logger.debug(
        `[UserExperienceService] Saved recently opened workspace: ${workspacePath}`,
      );
    } catch (error) {
      this.logger.error(
        `[UserExperienceService] Failed to save recently opened workspace. Error: ${error}`,
      );
      this.report(error as Error, 'saveRecentWorkspace');
    }
  }

  /**
   * Get combined stored experience data from separate files.
   * This combines data from recently-opened-workspaces.json, onboarding-state.json, and last-viewed-chats.json.
   */
  public async getStoredExperienceData(): Promise<StoredExperienceData> {
    const [recentlyOpenedWorkspaces, hasSeenOnboardingFlow, lastViewedChats] =
      await Promise.all([
        this.readRecentlyOpenedWorkspaces(),
        this.readOnboardingState(),
        this.readLastViewedChats(),
      ]);
    return {
      recentlyOpenedWorkspaces,
      hasSeenOnboardingFlow,
      lastViewedChats,
    };
  }

  public async setHasSeenOnboardingFlow(
    value: boolean,
    suggestion?: { id: string; url: string; prompt: string },
  ) {
    try {
      await this.writeOnboardingState(value);
      // Update UI state with combined data
      const storedData = await this.getStoredExperienceData();
      this.uiKarton.setState((draft) => {
        draft.userExperience.storedExperienceData = storedData;
        draft.userExperience.pendingOnboardingSuggestion = suggestion ?? null;
      });
      // Sync to pages API
      this.syncHomePageStateToPagesService();
      this.logger.debug(
        `[UserExperienceService] Set hasSeenOnboardingFlow to: ${value}`,
      );
    } catch (error) {
      this.logger.error(
        `[UserExperienceService] Failed to save hasSeenOnboardingFlow. Error: ${error}`,
      );
      this.report(error as Error, 'saveOnboardingState');
    }
  }

  /**
   * Mark a chat as viewed by the user.
   * Updates the lastViewedChats record with the current timestamp.
   */
  public async markChatAsViewed(agentId: string) {
    // Enqueue to serialize file I/O and prevent read-modify-write races
    this.markChatAsViewedQueue = this.markChatAsViewedQueue.then(
      () => this._markChatAsViewedImpl(agentId),
      () => this._markChatAsViewedImpl(agentId),
    );
    return this.markChatAsViewedQueue;
  }

  private async _markChatAsViewedImpl(agentId: string) {
    try {
      const lastViewedChats = await this.readLastViewedChats();
      lastViewedChats[agentId] = Date.now();
      await this.writeLastViewedChats(lastViewedChats);
      // Update UI state with combined data
      const storedData = await this.getStoredExperienceData();
      this.uiKarton.setState((draft) => {
        draft.userExperience.storedExperienceData = storedData;
      });
      // Sync to pages API
      this.syncHomePageStateToPagesService();
      this.logger.debug(
        `[UserExperienceService] Marked chat as viewed: ${agentId}`,
      );
    } catch (error) {
      this.logger.error(
        `[UserExperienceService] Failed to mark chat as viewed. Error: ${error}`,
      );
      this.report(error as Error, 'markChatAsViewed');
    }
  }

  /**
   * Set the PagesService instance for syncing home page state.
   * This should be called by main.ts after services are created.
   */
  public setPagesService(pagesService: PagesService): void {
    this.pagesService = pagesService;
    // Sync initial state
    this.syncHomePageStateToPagesService();
  }

  /**
   * Sync current home page state to PagesService.
   * Uses memoization for storedExperienceData to prevent infinite loops.
   */
  private syncHomePageStateToPagesService(): void {
    if (!this.pagesService) {
      return;
    }
    const state = this.uiKarton.state;

    // Stringify storedExperienceData for comparison (cheap memoization)
    const currentStoredData = JSON.stringify(
      state.userExperience.storedExperienceData,
    );

    // Check if storedExperienceData changed
    const storedDataChanged =
      currentStoredData !== this.lastSyncedStoredExperienceData;

    // Update memoization cache for storedExperienceData
    if (storedDataChanged)
      this.lastSyncedStoredExperienceData = currentStoredData;

    this.pagesService.syncHomePageState({
      storedExperienceData: storedDataChanged
        ? state.userExperience.storedExperienceData
        : undefined,
    });
  }

  private async pruneRecentlyOpenedWorkspaces({
    maxAmount,
    hasBeenOpenedBeforeDate,
  }: {
    maxAmount: number;
    hasBeenOpenedBeforeDate: number;
  }) {
    const workspaces = await this.readRecentlyOpenedWorkspaces();

    if (workspaces.length === 0) {
      this.logger.debug(
        `[UserExperienceService] No recently opened workspaces to prune`,
      );
      return;
    }

    // Filter out workspaces opened before the specified date
    let filteredWorkspaces = workspaces.filter(
      (ws) => ws.openedAt >= hasBeenOpenedBeforeDate,
    );

    // Sort by openedAt (most recent first)
    filteredWorkspaces.sort((a, b) => b.openedAt - a.openedAt);
    // Keep only the most recent maxAmount entries
    if (filteredWorkspaces.length > maxAmount) {
      filteredWorkspaces = filteredWorkspaces.slice(0, maxAmount);
    }

    try {
      await this.writeRecentlyOpenedWorkspaces(filteredWorkspaces);
      // Update UI state with combined data
      const storedData = await this.getStoredExperienceData();
      this.uiKarton.setState((draft) => {
        draft.userExperience.storedExperienceData = storedData;
      });
      this.logger.debug(
        `[UserExperienceService] Pruned recently opened workspaces. Kept ${filteredWorkspaces.length} entries`,
      );
    } catch (error) {
      this.logger.error(
        `[UserExperienceService] Failed to write pruned workspaces data. Error: ${error}`,
      );
      this.report(error as Error, 'pruneRecentWorkspaces');
    }
  }
}
