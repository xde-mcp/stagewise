import type {
  DiagnosticsByFile,
  ToolboxContextProvider,
} from '@/services/toolbox/types';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en';
import { DiagnosticSeverity } from 'vscode-languageserver-protocol';
import xml from 'xml';

TimeAgo.addLocale(en);
const timeAgo = new TimeAgo('en-US');

export const getApplicationStateContext = async (
  toolbox: ToolboxContextProvider,
  agentInstanceId: string,
) => {
  const browserSnapshot = await toolbox.getBrowserSnapshot();

  const workspaceSnapshot = toolbox.getWorkspaceSnapshot(agentInstanceId);

  const diagnostics = await toolbox.getLspDiagnosticsForAgent(agentInstanceId);

  return `
# Browser information

<open-tabs>${browserSnapshot.tabs
    .map(
      (tab) =>
        `<tab id="${tab.handle}" title="${tab.title.replace(/[\n\r]/g, ' ').replace('"', '\"')}" url="${tab.url}" consoleErrorCount="${tab.consoleErrorCount}" consoleLogCount="${tab.consoleLogCount}" error="${
          tab.error
            ? JSON.stringify(tab.error)
                .replace(/[\n\r]/g, ' ')
                .replace('"', '\"')
            : 'null'
        }" lastActiveAt="${timeAgo.format(new Date(tab.lastFocusedAt))}" active="${tab.id === browserSnapshot.activeTab?.id ? 'true' : 'false'}" />`,
    )
    .join('')}</open-tabs>

# Workspace Information

Workspace opened: ${workspaceSnapshot.workspacePath ? 'Yes' : 'No'}
${workspaceSnapshot.workspacePath ? `Absolute workspace path: "${workspaceSnapshot.workspacePath}"` : ''}

# Language server diagnostics

${diagnostics.keys.length > 0 ? formatLspDiagnosticsByFile(diagnostics, agentInstanceId) : 'No diagnostics found'}
    `.trim();
};

/**
 * Format LSP diagnostics grouped by file for inclusion in the system
 * prompt.
 */
function formatLspDiagnosticsByFile(
  diagnosticsByFile: DiagnosticsByFile,
  agentAccessPath: string,
): string {
  if (diagnosticsByFile.size === 0) return '';

  const getSeverityLabel = (severity: number | undefined): string => {
    switch (severity) {
      case DiagnosticSeverity.Error:
        return 'ERROR';
      case DiagnosticSeverity.Warning:
        return 'WARNING';
      case DiagnosticSeverity.Information:
        return 'INFO';
      case DiagnosticSeverity.Hint:
        return 'HINT';
      default:
        return 'ISSUE';
    }
  };

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalIssues = 0;

  const fileEntries: Array<{ file: object[] }> = [];

  for (const [filePath, diagnostics] of diagnosticsByFile) {
    if (diagnostics.length === 0) continue;

    // Make path relative to agent access path for cleaner display
    const relativePath = filePath.startsWith(agentAccessPath)
      ? filePath.slice(agentAccessPath.length).replace(/^\//, '')
      : filePath;

    const issues: string[] = [];
    for (const diag of diagnostics) {
      const d = diag.diagnostic;
      const severity = getSeverityLabel(d.severity);
      const line = d.range.start.line + 1;
      const col = d.range.start.character + 1;
      const source = d.source ?? diag.serverID;
      const code = d.code ? ` (${d.code})` : '';
      issues.push(
        `[${severity}] L${line}:${col} [${source}]${code}: ${d.message}`,
      );

      if (d.severity === DiagnosticSeverity.Error) totalErrors++;
      else if (d.severity === DiagnosticSeverity.Warning) totalWarnings++;
      totalIssues++;
    }

    fileEntries.push({
      file: [
        {
          _attr: {
            path: relativePath,
            'issue-count': diagnostics.length,
          },
        },
        { _cdata: issues.join('\n') },
      ],
    });
  }

  if (totalIssues === 0) return '';

  return xml({
    'lsp-diagnostics': [
      {
        _attr: {
          description:
            'Current linting/type-checking issues in recently touched files. [STAGE] MUST fix errors and SHOULD fix warnings caused by recent changes.',
          'total-issues': totalIssues,
          errors: totalErrors,
          warnings: totalWarnings,
        },
      },
      ...fileEntries,
      {
        action: {
          _cdata:
            'If any issues were introduced by recent code changes, fix them before proceeding. Prioritize errors over warnings.',
        },
      },
    ],
  });
}
