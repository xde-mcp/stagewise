import { createAgent } from '@stagewise-agent/core';
import * as vscode from 'vscode';
import type { PromptRequest } from '@stagewise/extension-toolbar-srpc-contract';

export async function* dispatchAgentCall(request: PromptRequest) {
  // Call our own agent right here !!
  const agent = createAgent({
    projectPath: vscode.workspace.rootPath ?? '',
  });

  try {
    // Create a queue to store chunks
    const chunkQueue: string[] = [];
    let isComplete = false;
    let resolveNext: (() => void) | null = null;

    // Set up the event listener for chunks
    agent.on('assistantChunk', (chunk) => {
      console.log('Assistant chunk: ', chunk);
      chunkQueue.push(chunk);
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    });

    // Start the prompt
    const promptPromise = agent.sendPrompt({
      prompt: request.user_request,
      url: request.url,
      selectedElements: request.selected_elements,
    });

    // When the prompt is complete, mark it as done
    promptPromise.then(() => {
      isComplete = true;
      if (resolveNext) {
        resolveNext();
      }
    });

    // Keep yielding chunks until we're done and the queue is empty
    while (!isComplete || chunkQueue.length > 0) {
      if (chunkQueue.length === 0) {
        // Wait for the next chunk
        await new Promise<void>((resolve) => {
          resolveNext = resolve;
        });
      }

      if (chunkQueue.length > 0) {
        yield chunkQueue.shift()!;
      }
    }

    await promptPromise;
  } catch (error) {
    vscode.window.showErrorMessage(`Error: ${error}`);
    console.error('Error: ', error);
    throw error;
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
