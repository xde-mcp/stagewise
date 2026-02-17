import { Button } from '@stagewise/stage-ui/components/button';
import { Loader2Icon } from 'lucide-react';
import type { AgentMessage } from '@shared/karton-contracts/ui/agent';
import type { StatusCardSection } from './shared';
import type { MouseEvent } from 'react';
import { FileIcon } from '../message-part-ui/tools/shared/file-icon';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import type { AgentToolUIPart } from '@shared/karton-contracts/ui/agent';

export type WorkspaceMdStatus = 'hidden' | 'running' | 'completed';

export interface WorkspaceMdStatusSectionProps {
  status: WorkspaceMdStatus;
  history: AgentMessage[];
  workspacePath?: string | null;
  onDismiss: () => void;
  onShowFile: () => void;
}

/**
 * Make a path relative to the workspace path for display
 */
function relativizePath(
  path: string | undefined,
  workspacePath: string | null | undefined,
): string | undefined {
  if (!path) return path;
  if (!workspacePath) return path;

  // Normalize both paths (handle trailing slashes)
  const normalizedWorkspace = workspacePath.replace(/\/+$/, '');
  const normalizedPath = path.replace(/\/+$/, '');

  if (normalizedPath.startsWith(normalizedWorkspace)) {
    // Remove workspace prefix and leading slash
    const relativePath = normalizedPath
      .slice(normalizedWorkspace.length)
      .replace(/^\/+/, '');
    return relativePath || '.';
  }

  return path;
}

/**
 * Extract status text from the last tool call in agent history.
 * Searches through ALL assistant messages (in reverse order) to find the
 * most recent tool part with a valid state, not just the last message.
 */
function getStatusText(
  history: AgentMessage[],
  workspacePath: string | null | undefined,
): string {
  const INITIALIZING_TEXT = 'Initializing .stagewise/WORKSPACE.md...';
  const ANALYZING_TEXT = 'Analyzing workspace...';

  // Get all assistant messages
  const assistantMessages = history?.filter((m) => m.role === 'assistant');
  const lastMessage = assistantMessages?.at(-1);

  // Search through all assistant messages in reverse order to find the last valid tool part
  let lastToolPart: AgentToolUIPart | undefined;
  for (
    let i = (assistantMessages?.length ?? 0) - 1;
    i >= 0 && !lastToolPart;
    i--
  ) {
    const msg = assistantMessages![i];
    const toolParts = msg.parts.filter((p) =>
      p.type.startsWith('tool-'),
    ) as AgentToolUIPart[];
    const filteredParts = toolParts.filter(
      (p) => p.state === 'input-available' || p.state === 'output-available',
    );
    lastToolPart = filteredParts.at(-1);
  }

  switch (lastToolPart?.type) {
    case 'tool-readFileTool': {
      const rawPath = lastToolPart.input?.relative_path;
      const relativePath = relativizePath(rawPath, workspacePath);
      const fileName = relativePath?.split('/').pop();
      return fileName ? `Reading ${fileName}...` : 'Reading file...';
    }
    case 'tool-listFilesTool': {
      const rawPath = lastToolPart.input?.relative_path;
      const p = relativizePath(rawPath, workspacePath);
      const relativePath = p === '' ? '/' : p === '.' ? '. ' : p;
      return relativePath
        ? `Listing files in ${relativePath}...`
        : 'Listing files...';
    }
    case 'tool-globTool': {
      const pattern = lastToolPart.input?.pattern;
      return pattern ? `Searching for ${pattern}...` : 'Searching files...';
    }
    case 'tool-grepSearchTool': {
      const query = lastToolPart.input?.query;
      return query ? `Searching code for ${query}...` : 'Searching code...';
    }
    case 'tool-writeWorkspaceMdTool': {
      return 'Writing .stagewise/WORKSPACE.md...';
    }
    default: {
      if (!lastMessage) return INITIALIZING_TEXT;

      // Check across all assistant messages for writeWorkspaceMdTool
      const hadWritingWorkspaceMd = assistantMessages?.some((m) =>
        m.parts.some((p) => p.type === 'tool-writeWorkspaceMdTool'),
      );
      const lastType = lastMessage.parts.at(-1)?.type;
      if (
        (lastType === 'reasoning' || lastType === 'text') &&
        hadWritingWorkspaceMd
      )
        return 'Finishing up...';

      return ANALYZING_TEXT;
    }
  }
}

function TooltipWrapper({
  children,
  showTooltip,
}: {
  children: React.ReactElement;
  showTooltip: boolean;
}) {
  if (!showTooltip) return children;
  return (
    <Tooltip>
      <TooltipTrigger>{children}</TooltipTrigger>
      <TooltipContent>
        Initializing .stagewise/WORKSPACE.md for frontend-aware workspace
        context.
      </TooltipContent>
    </Tooltip>
  );
}

export function WorkspaceMdStatusSection({
  status,
  history,
  workspacePath,
  onDismiss,
  onShowFile,
}: WorkspaceMdStatusSectionProps): StatusCardSection | null {
  if (status === 'hidden') return null;

  const isRunning = status === 'running';
  const statusText = getStatusText(history, workspacePath);
  return {
    key: 'project-md-status',
    defaultOpen: true,
    trigger: () => (
      <TooltipWrapper showTooltip={isRunning}>
        <div className="flex h-6 w-full flex-row items-center justify-between gap-2 pl-1.5 text-muted-foreground text-xs hover:text-foreground has-[button:hover]:text-muted-foreground">
          {isRunning ? (
            <div className="flex flex-row items-center gap-2">
              <div className="relative flex size-3 shrink-0 items-center justify-center">
                <Loader2Icon className="size-3 animate-spin text-primary-foreground" />
              </div>
              <span className="shimmer-text-primary truncate font-normal">
                Generating workspace context
              </span>
            </div>
          ) : (
            <>
              <div className="flex flex-row items-center gap-1 truncate">
                <FileIcon
                  filePath=".stagewise/WORKSPACE.md"
                  className="size-5 shrink-0"
                />
                <Tooltip>
                  <TooltipTrigger>
                    <span className="text-foreground text-xs leading-none">
                      WORKSPACE.md
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>.stagewise/WORKSPACE.md</TooltipContent>
                </Tooltip>
                <span className="font-normal text-muted-foreground">
                  generated
                </span>
              </div>
              <div className="ml-auto flex flex-row items-center justify-start gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  className="shrink-0 cursor-pointer"
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                >
                  Done
                </Button>
                <Button
                  variant="primary"
                  size="xs"
                  className="shrink-0 cursor-pointer"
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    onShowFile();
                  }}
                >
                  Show file
                </Button>
              </div>
            </>
          )}
        </div>
      </TooltipWrapper>
    ),
    contentClassName: 'px-1.5 pb-1 pt-1.5',
    content:
      status === 'running' ? (
        <div className="flex flex-row items-center justify-start gap-1">
          <span className="font-normal text-muted-foreground text-xs leading-none">
            {statusText}
          </span>
        </div>
      ) : undefined,
  };
}
