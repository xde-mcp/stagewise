import type {
  ToolboxContextProvider,
  WorkspaceSnapshot,
} from '@/services/toolbox/types';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en';

TimeAgo.addLocale(en);
const timeAgo = new TimeAgo('en-US');

function formatMountedWorkspaces(snapshot: WorkspaceSnapshot): string {
  if (snapshot.mounts.length === 0) return 'No workspaces mounted.';
  return snapshot.mounts
    .map(
      (m) =>
        `- ${m.prefix}: ${m.path} (use '${m.prefix}/...' to address files)`,
    )
    .join('\n');
}

export const getApplicationStateContext = async (
  toolbox: ToolboxContextProvider,
  agentInstanceId: string,
) => {
  const browserSnapshot = toolbox.getBrowserSnapshot();

  const workspaceSnapshot = toolbox.getWorkspaceSnapshot(agentInstanceId);

  const shellInfo = toolbox.getShellInfo();
  const shellSection = shellInfo
    ? `\n# Shell Environment\n\nPlatform: ${process.platform}\nShell: ${shellInfo.type} (${shellInfo.path})`
    : '';

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

# Mounted Workspaces

${formatMountedWorkspaces(workspaceSnapshot)}

## Always-Available Mounts

These mounts are always present regardless of whether a workspace is connected:

- att/: Agent attachment directory (use 'att/...' to read/write attachments). Append-only permissions.
- plugins/: Installed plugin files and skills (use 'plugins/...' to read plugin data). Read-only permissions.
${shellSection}
    `.trim();
};
