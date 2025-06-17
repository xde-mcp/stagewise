import { createAgent } from '@stagewise-agent/core';
import * as vscode from 'vscode';
import type { PromptRequest } from '@stagewise/extension-toolbar-srpc-contract';

export async function dispatchAgentCall(request: PromptRequest) {
  // Call our own agent right here !!
  const agent = createAgent({
    projectPath: vscode.workspace.rootPath ?? '',
  });

  agent.on('agentStarted', () => {
    vscode.window.showInformationMessage('Agent started');
  });

  agent.on('message', (message) => {
    console.error(`Message: ${JSON.stringify(message)}`);
  });

  try {
    const result = await agent.sendMessage({
      prompt: request.user_request,
      url: request.url,
      selectedElements: request.selected_elements,
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error}`);
    console.error('Error: ', error);
  }

  // const ide = getCurrentIDE();
  // switch (ide) {
  //   case 'CURSOR':
  //     return await callCursorAgent(request);
  //   case 'WINDSURF':
  //     return await callWindsurfAgent(request);
  //   case 'VSCODE':
  //     if (isCopilotChatInstalled()) return await callCopilotAgent(request);
  //     else {
  //       vscode.window.showErrorMessage(
  //         'Currently, only Copilot Chat is supported for VSCode. Please install it from the marketplace to use stagewise with VSCode.',
  //       );
  //       break;
  //     }
  //   case 'UNKNOWN':
  //     vscode.window.showErrorMessage(
  //       'Failed to call agent: IDE is not supported',
  //     );
  // }
}
