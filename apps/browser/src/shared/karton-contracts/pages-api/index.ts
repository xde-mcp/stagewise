import type {
  HistoryFilter,
  HistoryResult,
  FaviconBitmapResult,
  ClearBrowsingDataOptions,
  ClearBrowsingDataResult,
  DownloadsFilter,
  DownloadResult,
  ActiveDownloadInfo,
  DownloadControlResult,
  PendingEditsResult,
  SearchEngine,
  AddSearchEngineInput,
  AddSearchEngineResult,
  RemoveSearchEngineResult,
  InspirationWebsite,
  StoredExperienceData,
  WorkspaceStatus,
  ContextFilesResult,
  ExternalFileContentResult,
} from './types';
import type {
  UserPreferences,
  Patch,
  GlobalConfig,
  ModelProvider,
} from '../ui/shared-types';
import type { ApiKeyValidationResult, AuthStatus } from '../ui';
import type { FileDiff } from '../ui/shared-types';
import { defaultUserPreferences } from '../ui/shared-types';

export type PagesApiState = {
  /** Active downloads currently in progress, keyed by download ID */
  activeDownloads: Record<number, ActiveDownloadInfo>;
  /** Pending file edits by chat ID, pushed in real-time */
  pendingEditsByAgentInstanceId: Record<string, FileDiff[]>;
  /** User preferences (read-only sync) */
  preferences: UserPreferences;
  /** Global config (read-only sync, updated via setGlobalConfig procedure) */
  globalConfig: GlobalConfig;
  /** Available search engines from Web Data database */
  searchEngines: SearchEngine[];
  /** Home page state (for stagewise://internal/home) */
  homePage: {
    storedExperienceData: StoredExperienceData;
    workspaceStatus: WorkspaceStatus;
  };
  /** User account status, synced from AuthService */
  userAccount: {
    status: AuthStatus;
    machineId?: string;
    user?: {
      id: string;
      email: string;
    };
    subscription?: {
      active: boolean;
      plan?: string;
      expiresAt?: string;
    };
  };
  // Current stagewise app runtime information
  appInfo: {
    baseName: string; // Base name (e.g., 'stagewise-dev', 'stagewise-prerelease', 'stagewise').
    name: string; // Display name (e.g., 'stagewise (Dev-Build)', 'stagewise').
    bundleId: string; // Bundle ID (e.g., 'io.stagewise.dev').
    version: string; // The version of the app.
    platform: 'darwin' | 'linux' | 'win32'; // The platform on which the app is running.
    // Build-time constants
    releaseChannel: 'dev' | 'prerelease' | 'release'; // The release channel of the app.
    author: string; // Author name.
    copyright: string; // Copyright string.
    homepage: string; // Homepage URL.
    arch: string; // Architecture (e.g., 'x64', 'arm64').
    otherVersions: Record<string, string | undefined>; // Other versions of the app.
  };
};

export type PagesApiContract = {
  state: PagesApiState;
  serverProcedures: {
    getHistory: (filter: HistoryFilter) => Promise<HistoryResult[]>;
    getDownloads: (filter: DownloadsFilter) => Promise<DownloadResult[]>;
    getActiveDownloads: () => Promise<ActiveDownloadInfo[]>;
    deleteDownload: (downloadId: number) => Promise<DownloadControlResult>;
    pauseDownload: (downloadId: number) => Promise<DownloadControlResult>;
    resumeDownload: (downloadId: number) => Promise<DownloadControlResult>;
    cancelDownload: (downloadId: number) => Promise<DownloadControlResult>;
    /** Open a downloaded file using the system default application */
    openDownloadFile: (filePath: string) => Promise<DownloadControlResult>;
    /** Show a downloaded file in the system file manager (Finder/Explorer) */
    showDownloadInFolder: (filePath: string) => Promise<DownloadControlResult>;
    /** Mark all downloads as seen (updates lastSeenAt timestamp for UI) */
    markDownloadsSeen: () => Promise<void>;
    getFaviconBitmaps: (
      faviconUrls: string[],
    ) => Promise<Record<string, FaviconBitmapResult>>;
    openTab: (url: string, setActive?: boolean) => Promise<void>;
    clearBrowsingData: (
      options: ClearBrowsingDataOptions,
    ) => Promise<ClearBrowsingDataResult>;
    /** Get pending file edits for a specific chat */
    getPendingEdits: (agentInstanceId: string) => Promise<PendingEditsResult>;
    /** Accept all pending edits for a specific chat */
    acceptAllPendingEdits: (agentInstanceId: string) => Promise<void>;
    /** Reject all pending edits for a specific chat */
    rejectAllPendingEdits: (agentInstanceId: string) => Promise<void>;
    /** Accept a single pending edit by file path */
    acceptPendingEdit: (agentInstanceId: string, path: string) => Promise<void>;
    /** Reject a single pending edit by file path */
    rejectPendingEdit: (agentInstanceId: string, path: string) => Promise<void>;
    /**
     * Get content of an external (binary/large) file by its blob OID.
     * Returns base64-encoded content and inferred MIME type.
     * Returns null if the blob is not found.
     */
    getExternalFileContent: (
      oid: string,
    ) => Promise<ExternalFileContentResult | null>;
    /** Get current user preferences */
    getPreferences: () => Promise<UserPreferences>;
    /** Update user preferences by applying Immer patches */
    updatePreferences: (patches: Patch[]) => Promise<void>;
    /** Get all available search engines */
    getSearchEngines: () => Promise<SearchEngine[]>;
    /** Add a new custom search engine (URL should use %s placeholder) */
    addSearchEngine: (
      input: AddSearchEngineInput,
    ) => Promise<AddSearchEngineResult>;
    /** Remove a custom search engine by ID */
    removeSearchEngine: (id: number) => Promise<RemoveSearchEngineResult>;
    /** Fetch inspiration websites with pagination (results are cached) */
    getInspirationWebsites: (params: {
      offset: number;
      limit: number;
    }) => Promise<InspirationWebsite>;
    /** Set whether user has seen the onboarding flow */
    setHasSeenOnboardingFlow: (value: boolean) => Promise<void>;
    /** Open a workspace (shows file picker if no path provided) */
    openWorkspace: (path?: string) => Promise<void>;
    /**
     * Trust a certificate for a specific origin in a tab and reload.
     * This adds the origin to a per-tab whitelist that allows certificate errors.
     * The whitelist is cleared when the tab is closed.
     */
    trustCertificateAndReload: (tabId: string, origin: string) => Promise<void>;
    /** Set the global config (e.g., preferred IDE for opening files) */
    setGlobalConfig: (config: GlobalConfig) => Promise<void>;
    /**
     * Get context files info (, AGENTS.md) for the current workspace.
     * Returns null if no workspace is loaded.
     */
    getContextFiles: () => Promise<ContextFilesResult>;
    /** Set an encrypted API key for a provider (encrypted via safeStorage on backend) */
    setProviderApiKey: (
      provider: ModelProvider,
      apiKey: string,
    ) => Promise<void>;
    /** Clear the API key for a provider */
    clearProviderApiKey: (provider: ModelProvider) => Promise<void>;
    /** Set an encrypted API key for a custom endpoint */
    setCustomEndpointApiKey: (
      endpointId: string,
      apiKey: string,
    ) => Promise<void>;
    /** Clear the API key for a custom endpoint */
    clearCustomEndpointApiKey: (endpointId: string) => Promise<void>;
    /** Validate a provider API key by making a lightweight test request */
    validateProviderApiKey: (
      provider: ModelProvider,
      apiKey: string,
      baseUrl?: string,
    ) => Promise<ApiKeyValidationResult>;
    /** Send an OTP code to the given email for sign-in */
    sendOtp: (email: string) => Promise<{ error?: string }>;
    /** Verify an OTP code for the given email */
    verifyOtp: (email: string, code: string) => Promise<{ error?: string }>;
    /** Log the current user out */
    logout: () => Promise<void>;
  };
};

export const defaultState: PagesApiState = {
  activeDownloads: {},
  pendingEditsByAgentInstanceId: {},
  preferences: defaultUserPreferences,
  globalConfig: {
    telemetryLevel: 'full',
    openFilesInIde: 'other',
  },
  userAccount: {
    status: 'unauthenticated',
  },
  searchEngines: [],
  homePage: {
    storedExperienceData: {
      recentlyOpenedWorkspaces: [],
      hasSeenOnboardingFlow: false,
      lastViewedChats: {},
    },
    workspaceStatus: 'closed',
  },
  appInfo: {
    baseName: __APP_BASE_NAME__,
    name: __APP_NAME__,
    bundleId: __APP_BUNDLE_ID__,
    version: __APP_VERSION__,
    platform: __APP_PLATFORM__ as 'darwin' | 'linux' | 'win32',
    releaseChannel: __APP_RELEASE_CHANNEL__,
    author: __APP_AUTHOR__,
    copyright: __APP_COPYRIGHT__,
    homepage: __APP_HOMEPAGE__,
    arch: __APP_ARCH__,
    otherVersions: {},
  },
};
