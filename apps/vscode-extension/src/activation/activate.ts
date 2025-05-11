import * as vscode from 'vscode';
import { startServer, stopServer } from '../http-server/server';
import { updateCursorMcpConfig } from './register-mcp-server';
import { findAvailablePort } from '../utils/find-available-port';
import { callCursorAgent } from '../utils/call-cursor-agent';
import {
  getExtensionBridge,
  DEFAULT_PORT,
} from '@stagewise/extension-toolbar-srpc-contract';
import { setupToolbar } from './setup-toolbar';
import { getCurrentIDE } from 'src/utils/get-current-ide';
import { callWindsurfAgent } from 'src/utils/call-windsurf-agent';

// Diagnostic collection specifically for our fake prompt
const fakeDiagCollection =
  vscode.languages.createDiagnosticCollection('stagewise');

// Dummy handler for the setupToolbar command
async function setupToolbarHandler() {
  await setupToolbar();
}

export async function activate(context: vscode.ExtensionContext) {
  const ide = getCurrentIDE();
  if (ide === 'UNKNOWN') {
    vscode.window.showInformationMessage(
      'stagewise does not work for your current IDE.',
    );
    return;
  }
  context.subscriptions.push(fakeDiagCollection); // Dispose on deactivation

  try {
    // Find an available port
    const port = await findAvailablePort(DEFAULT_PORT);

    // Register MCP server with the actual port
    updateCursorMcpConfig(port);

    // Start the HTTP server with the same port
    const server = await startServer(port);
    const bridge = getExtensionBridge(server);

    bridge.register({
      triggerAgentPrompt: async (request, sendUpdate) => {
        await determineAndCallAgent(request.prompt);
        sendUpdate.sendUpdate({ updateText: 'Called the agent' });

        return { result: { success: true } };
      },
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to start server: ${error}`);
    throw error;
  }

  // Register the setupToolbar command
  const setupToolbarCommand = vscode.commands.registerCommand(
    'stagewise.setupToolbar',
    setupToolbarHandler,
  );
  context.subscriptions.push(setupToolbarCommand);
}

export async function deactivate() {
  await stopServer();
}

export async function determineAndCallAgent(prompt: string) {
  const ide = getCurrentIDE();
  switch (ide) {
    case 'CURSOR':
      return await callCursorAgent(prompt);
    case 'WINDSURF':
      return await callWindsurfAgent(prompt);
    case 'VSCODE':
    case 'UNKNOWN':
      vscode.window.showErrorMessage(
        'Failed to call agent: IDE is not supported',
      );
  }
}
