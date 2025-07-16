import * as vscode from 'vscode';
import { Agent as StagewiseAgentService } from '@stagewise-agent/client-sdk';
import { setupToolbar } from '../auto-prompts/setup-toolbar';
import { getCurrentIDE } from 'src/utils/get-current-ide';
import { AnalyticsService, EventName } from 'src/services/analytics-service';
import {
  createGettingStartedPanel,
  shouldShowGettingStarted,
} from '../webviews/getting-started';
import { StorageService } from 'src/services/storage-service';
import { VScodeContext } from 'src/services/vscode-context';
import { EnvironmentInfo } from 'src/services/environment-info';
import { ToolbarUpdateNotificator } from 'src/services/toolbar-update-notificator';
import { ToolbarIntegrationNotificator } from 'src/services/toolbar-integration-notificator';
import { WorkspaceService } from 'src/services/workspace-service';
import { RegistryService } from 'src/services/registry-service';
import { AuthService } from 'src/services/auth-service';
import { AgentService as IDEAgentService } from 'src/services/agent-service';
import { RetroAgentService } from 'src/services/agent-service/retro';
import { ClientRuntimeVSCode } from '@stagewise-agent/implementation-client-runtime-vscode';

let stagewiseAgentInitialized = false;
let ideAgentInitialized = false;

let stagewiseAgentServiceInstance: StagewiseAgentService | null = null;

// Diagnostic collection specifically for our fake prompt
const fakeDiagCollection =
  vscode.languages.createDiagnosticCollection('stagewise');

// Create output channel for stagewise
const outputChannel = vscode.window.createOutputChannel('stagewise');

// Handler for the setupToolbar command
async function setupToolbarHandler() {
  await setupToolbar();
  await vscode.window.showInformationMessage(
    "The agent has been started to integrate stagewise into this project. Please follow the agent's instructions in the chat panel.",
    'OK',
  );
}

// Helper functions for agent management
async function initializeIDEAgent() {
  if (ideAgentInitialized) {
    return; // Already initialized
  }
  const ideAgentService = IDEAgentService.getInstance();
  await ideAgentService.initialize();
  ideAgentInitialized = true;
}

async function shutdownIDEAgent() {
  if (!ideAgentInitialized) {
    return; // Not initialized
  }
  const ideAgentService = IDEAgentService.getInstance();
  await ideAgentService.shutdown();
  ideAgentInitialized = false;
}

async function initializeStagewiseAgent(
  stagewiseAgentService: StagewiseAgentService,
) {
  if (stagewiseAgentInitialized) {
    return; // Already initialized
  }
  try {
    await stagewiseAgentService.initialize();
    stagewiseAgentInitialized = true;
  } catch (error) {
    console.error(
      'Failed to initialize stagewise agent:',
      error instanceof Error ? error.message : String(error),
    );
    stagewiseAgentInitialized = false;
    throw error; // Re-throw to handle fallback
  }
}

async function shutdownStagewiseAgent() {
  if (!stagewiseAgentInitialized) {
    return; // Not initialized
  }
  stagewiseAgentServiceInstance?.shutdown();
  stagewiseAgentInitialized = false;
}

export async function activate(context: vscode.ExtensionContext) {
  try {
    // Initialize all services in the correct order
    VScodeContext.getInstance().initialize(context);
    await StorageService.getInstance().initialize();

    const analyticsService = AnalyticsService.getInstance();
    analyticsService.initialize();

    WorkspaceService.getInstance();
    RegistryService.getInstance();
    await EnvironmentInfo.getInstance().initialize();

    const integrationNotificator = ToolbarIntegrationNotificator.getInstance();
    integrationNotificator.initialize();
    context.subscriptions.push(integrationNotificator);

    const updateNotificator = ToolbarUpdateNotificator.getInstance();
    updateNotificator.initialize();
    context.subscriptions.push(updateNotificator);

    // Initialize AuthService
    const authService = AuthService.getInstance();

    stagewiseAgentServiceInstance = StagewiseAgentService.getInstance({
      clientRuntime: new ClientRuntimeVSCode(),
      accessToken: (await authService.getAccessToken()) ?? undefined,
    });

    // Set up auth state change handler
    authService.onAuthStateChanged(async (authState) => {
      // Update access token for stagewise agent if available
      if (authState.accessToken) {
        stagewiseAgentServiceInstance?.reauthenticateTRPCClient(
          authState.accessToken,
        );
      }

      // Handle stagewise agent based on auth state (IDE agent always runs)
      if (authState.isAuthenticated && authState.hasEarlyAgentAccess) {
        // User has auth and early access - initialize stagewise agent
        if (stagewiseAgentServiceInstance && !stagewiseAgentInitialized) {
          try {
            await initializeStagewiseAgent(stagewiseAgentServiceInstance);
          } catch (error) {
            console.error(
              'Failed to initialize stagewise agent on auth state change:',
              error instanceof Error ? error.message : String(error),
            );
          }
        }
      } else {
        // User is not authenticated or doesn't have early access - shutdown stagewise agent if running
        if (stagewiseAgentInitialized) {
          await shutdownStagewiseAgent();
        }
      }
    });

    // Initial agent setup - IDE agent always runs
    await initializeIDEAgent();

    // Additionally initialize stagewise agent if authenticated with early access
    const authState = await authService.getAuthState();
    if (
      authState?.isAuthenticated &&
      authState?.accessToken &&
      authState?.hasEarlyAgentAccess
    ) {
      // User has auth and early access - initialize stagewise agent in addition to IDE agent
      try {
        await initializeStagewiseAgent(stagewiseAgentServiceInstance);
      } catch (error) {
        // Log error but continue with IDE agent only
        console.error(
          'Initial stagewise agent initialization failed:',
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const uriHandler = vscode.window.registerUriHandler({
      handleUri: async (uri: vscode.Uri) => {
        if (uri.path === '/authenticate') {
          await authService.handleAuthenticationUri(uri);
        }
      },
    });
    context.subscriptions.push(uriHandler);

    // Always initialize RetroAgent
    const retroAgentService = RetroAgentService.getInstance();
    await retroAgentService.initialize();

    const ide = getCurrentIDE();
    if (ide === 'UNKNOWN') {
      vscode.window.showInformationMessage(
        'stagewise does not work for your current IDE.',
      );
      return;
    }
    context.subscriptions.push(fakeDiagCollection); // Dispose on deactivation
    context.subscriptions.push(outputChannel); // Dispose output channel on deactivation

    const storage = StorageService.getInstance();

    // Add configuration change listener to track telemetry setting changes
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(
      async (e) => {
        if (e.affectsConfiguration('stagewise.telemetry.enabled')) {
          const config = vscode.workspace.getConfiguration('stagewise');
          const telemetryEnabled = config.get<boolean>(
            'telemetry.enabled',
            true,
          );

          // Track the telemetry state change using the dedicated function
          analyticsService.trackTelemetryStateChange(telemetryEnabled);
        }
      },
    );

    context.subscriptions.push(configChangeListener);

    // Function to show getting started panel if needed
    const showGettingStartedIfNeeded = async () => {
      if (await shouldShowGettingStarted(storage)) {
        analyticsService.trackEvent(EventName.GETTING_STARTED_PANEL_SHOWN);
        createGettingStartedPanel(context, storage, setupToolbarHandler);
      }
    };

    if (vscode.workspace.workspaceFolders?.length) {
      // Show getting started panel on workspace load (activation)
      await showGettingStartedIfNeeded();
    }

    // Listen for workspace folder changes (workspace loaded)
    const workspaceFolderListener =
      vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        if (vscode.workspace.workspaceFolders?.length) {
          await showGettingStartedIfNeeded();
        }
      });
    context.subscriptions.push(workspaceFolderListener);

    // Register the setupToolbar command
    const setupToolbarCommand = vscode.commands.registerCommand(
      'stagewise.setupToolbar',
      async () => {
        try {
          analyticsService.trackEvent(EventName.TOOLBAR_AUTO_SETUP_STARTED);
          await setupToolbarHandler();
        } catch (error) {
          console.error(
            'Error during toolbar setup:',
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        }
      },
    );
    context.subscriptions.push(setupToolbarCommand);

    // Register the show getting started command
    const showGettingStartedCommand = vscode.commands.registerCommand(
      'stagewise.showGettingStarted',
      async () => {
        try {
          analyticsService.trackEvent(
            EventName.GETTING_STARTED_PANEL_MANUAL_SHOW,
          );
          createGettingStartedPanel(context, storage, setupToolbarHandler);
        } catch (error) {
          console.error(
            'Error showing getting started panel:',
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        }
      },
    );
    context.subscriptions.push(showGettingStartedCommand);

    // Register authentication commands
    const authenticateCommand = vscode.commands.registerCommand(
      'stagewise.authenticate',
      async () => {
        try {
          analyticsService.trackEvent(EventName.AUTHENTICATE_COMMAND_TRIGGERED);
          await authService.authenticate();
        } catch (error) {
          console.error(
            'Error during authentication:',
            error instanceof Error ? error.message : String(error),
          );
          vscode.window.showErrorMessage(
            `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
          );
        }
      },
    );
    context.subscriptions.push(authenticateCommand);

    const logoutCommand = vscode.commands.registerCommand(
      'stagewise.logout',
      async () => {
        try {
          analyticsService.trackEvent(EventName.LOGOUT_COMMAND_TRIGGERED);
          await authService.logout();
        } catch (error) {
          console.error(
            'Error during logout:',
            error instanceof Error ? error.message : String(error),
          );
          vscode.window.showErrorMessage(
            `Logout failed: ${error instanceof Error ? error.message : 'Please try again.'}`,
          );
        }
      },
    );
    context.subscriptions.push(logoutCommand);

    const checkAuthStatusCommand = vscode.commands.registerCommand(
      'stagewise.checkAuthStatus',
      async () => {
        try {
          analyticsService.trackEvent(
            EventName.CHECK_AUTH_STATUS_COMMAND_TRIGGERED,
          );
          await authService.checkAuthStatus();
        } catch (error) {
          console.error(
            'Error checking auth status:',
            error instanceof Error ? error.message : String(error),
          );
          vscode.window.showErrorMessage(
            `Failed to check authentication status: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      },
    );
    context.subscriptions.push(checkAuthStatusCommand);
  } catch (error) {
    console.error('Error during extension activation:', error);
  }
}

export async function deactivate(_context: vscode.ExtensionContext) {
  try {
    AnalyticsService.getInstance().shutdown();

    // Shutdown stagewise agent if initialized
    if (stagewiseAgentInitialized) {
      await shutdownStagewiseAgent();
    }

    // Shutdown IDE agent if initialized
    if (ideAgentInitialized) {
      await shutdownIDEAgent();
    }

    // Always shutdown RetroAgent
    const retroAgentService = RetroAgentService.getInstance();
    await retroAgentService.shutdown();
  } catch (error) {
    // Log error but don't throw during deactivation
    console.error(
      'Error during extension deactivation:',
      error instanceof Error ? error.message : String(error),
    );
  }
}
