import * as vscode from 'vscode';
import { DIAGNOSTIC_COLLECTION_NAME } from '../constants';

export async function callCursorAgent(prompt: string): Promise<void> {
  let editor = vscode.window.activeTextEditor;
  if (!editor) {
    try {
      // Get all workspace files
      const files = await vscode.workspace.findFiles(
        '**/*',
        '**/node_modules/**',
      );

      if (files.length === 0) {
        vscode.window.showErrorMessage('No files found in workspace to open.');
        return;
      }

      // Open the first file found
      const document = await vscode.workspace.openTextDocument(files[0]);
      editor = await vscode.window.showTextDocument(document);
    } catch (error) {
      vscode.window.showErrorMessage(
        'Failed to open existing file for prompt injection.',
      );
      return;
    }
  }

  const document = editor.document; // Get document early

  // --- Create the Diagnostic Collection ONCE before try/finally ---
  // This collection will be used to both set and clear the diagnostic.
  const fakeDiagCollection = vscode.languages.createDiagnosticCollection(
    DIAGNOSTIC_COLLECTION_NAME,
  );

  try {
    // Use a large range or the current selection - using full doc range here
    // Consider using editor.selection if you want it tied to selected code
    const selectionOrFullDocRange = editor.selection.isEmpty
      ? new vscode.Range(0, 0, document.lineCount, 0) // Fallback to full doc if no selection
      : editor.selection; // Use actual selection if available
    // 1. Create the fake diagnostic object
    const fakeDiagnostic = new vscode.Diagnostic(
      selectionOrFullDocRange,
      prompt,
      vscode.DiagnosticSeverity.Error,
    );
    fakeDiagnostic.source = DIAGNOSTIC_COLLECTION_NAME;

    // 2. Set the diagnostic using the collection created outside the try block
    fakeDiagCollection.set(document.uri, [fakeDiagnostic]);

    // 3. Ensure cursor is within the diagnostic range (e.g., start)
    // This might help with the '@composer.isCursorOnLint' context, but may not be sufficient
    editor.selection = new vscode.Selection(
      selectionOrFullDocRange.start,
      selectionOrFullDocRange.start,
    );

    // 5. Execute the command
    await vscode.commands.executeCommand('composer.fixerrormessage');
    vscode.window.showInformationMessage(`Triggered agent for prompt.`); // Simplified message
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to inject prompt: ${error}`);
  } finally {
    // --- CRUCIAL: Use the SAME collection instance created ABOVE the try block ---
    if (document) {
      // Check if document still valid (it should be)
      // Clear the specific diagnostic for this URI from the collection
      fakeDiagCollection.delete(document.uri);
      // Alternatively, clear all diagnostics managed by this collection:
      // fakeDiagCollection.clear();
    } else {
      fakeDiagCollection.clear(); // Clear everything if URI is lost
    }
    // --- Dispose the collection to clean up resources ---
    fakeDiagCollection.dispose();
  }
}
