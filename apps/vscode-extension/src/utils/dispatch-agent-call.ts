import { getCurrentIDE } from './get-current-ide';
import { callCursorAgent } from './call-cursor-agent';
import { callWindsurfAgent } from './call-windsurf-agent';
import * as vscode from 'vscode';

export async function dispatchAgentCall(prompt: string) {
  const ide = getCurrentIDE();
  switch (ide) {
    case 'CURSOR':
      return await callCursorAgent(prompt);
    case 'WINDSURF':
      return await callWindsurfAgent(prompt);
    case 'VSCODE':
      vscode.window.showErrorMessage(
        'Currently, only Cursor and Windsurf are supported with stagewise.',
      );
      break;
    case 'UNKNOWN':
      vscode.window.showErrorMessage(
        'Failed to call agent: IDE is not supported',
      );
  }
}
