import { getCurrentIDE } from './get-current-ide';
import { callCursorAgent } from './call-cursor-agent';
import { isCopilotChatInstalled } from './is-copilot-chat-installed';
import { callCopilotAgent } from './call-copilot-agent';
import { callWindsurfAgent } from './call-windsurf-agent';
import { isRoocodeInstalled } from './is-roocode-installed';
import { callRoocodeAgent } from './call-roocode-agent';
import { callClineAgent } from './call-cline-agent';
import * as vscode from 'vscode';
import type { PromptRequest } from '@stagewise/extension-toolbar-srpc-contract';
import { isClineInstalled } from './is-cline-installed';
import { callTraeAgent } from './call-trae-agent';

export async function dispatchAgentCall(request: PromptRequest) {
  const ide = getCurrentIDE();
  switch (ide) {
    case 'TRAE':  
      return await callTraeAgent(request);
    case 'CURSOR':
      return await callCursorAgent(request);
    case 'WINDSURF':
      return await callWindsurfAgent(request);
    case 'VSCODE':
      if (isClineInstalled()) return await callClineAgent(request);
      if (isRoocodeInstalled()) return await callRoocodeAgent(request);
      if (isCopilotChatInstalled()) return await callCopilotAgent(request);
      else {
        vscode.window.showErrorMessage(
          'Currently, only Copilot Chat is supported for VSCode. Please install it from the marketplace to use stagewise with VSCode.',
        );
        break;
      }
    case 'UNKNOWN':
      vscode.window.showErrorMessage(
        'Failed to call agent: IDE is not supported',
      );
  }
}
