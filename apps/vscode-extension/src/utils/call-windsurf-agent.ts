import * as vscode from 'vscode';
import { injectPromptDiagnosticWithCallback } from './inject-prompt-diagnostic-with-callback';

const WINDSURF_PROMPT_PREFIX =
  "Ah wait, it's not a problem. The user has instead submitted a change request. Please implement it: \n\n";

export async function callWindsurfAgent(prompt: string): Promise<void> {
  const promptWithPrefix = `${WINDSURF_PROMPT_PREFIX}\n${prompt}`;
  await injectPromptDiagnosticWithCallback({
    prompt: promptWithPrefix,
    callback: () =>
      vscode.commands.executeCommand(
        'windsurf.prioritized.explainProblem',
      ) as Promise<any>,
  });
}
