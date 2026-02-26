const TOOL_LABELS: Record<string, string> = {
  'tool-multiEditTool': 'Editing files',
  'tool-overwriteFileTool': 'Writing file',
  'tool-readFileTool': 'Reading file',
  'tool-grepSearchTool': 'Searching code',
  'tool-globTool': 'Finding files',
  'tool-listFilesTool': 'Listing files',
  'tool-deleteFileTool': 'Deleting file',
  'tool-executeSandboxJsTool': 'Running script',
  'tool-readConsoleLogsTool': 'Reading console',
  'tool-getLintingDiagnosticsTool': 'Checking lint',
  'tool-updateWorkspaceMdTool': 'Updating workspace',
  'tool-searchInLibraryDocsTool': 'Searching docs',
  'tool-listLibraryDocsTool': 'Looking up docs',
  'tool-askUserQuestionsTool': 'Asking questions',
};

export function getToolActivityLabel(toolPartType: string): string {
  return TOOL_LABELS[toolPartType] ?? 'Working';
}
