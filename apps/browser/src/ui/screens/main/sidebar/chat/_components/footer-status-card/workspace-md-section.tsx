import { Button } from '@stagewise/stage-ui/components/button';
import { stripMountPrefix } from '@/utils';
import { Loader2Icon, XIcon } from 'lucide-react';
import type { AgentMessage } from '@shared/karton-contracts/ui/agent';
import type { StatusCardSection } from './shared';
import type { MouseEvent } from 'react';
import { FileIcon } from '@/components/file-icon';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import type { AgentToolUIPart } from '@shared/karton-contracts/ui/agent';

export type WorkspaceMdStatus = 'hidden' | 'running' | 'completed' | 'error';

interface MountEntry {
  prefix: string;
  path: string;
}

export interface WorkspaceMdStatusSectionProps {
  status: WorkspaceMdStatus;
  history: AgentMessage[];
  workspaceMounts?: MountEntry[];
  errorMessage?: string | null;
  onDismiss: () => void;
  onShowFile: () => void;
}

function relativizePath(
  filePath: string | undefined,
  mounts: MountEntry[] | undefined,
): string | undefined {
  if (!filePath || !mounts || mounts.length === 0) return filePath;

  const normalizedPath = stripMountPrefix(filePath);
  for (const mount of mounts) {
    const normalizedMount = mount.path.replace(/\/+$/, '');
    if (normalizedPath.startsWith(normalizedMount)) {
      const rel = normalizedPath
        .slice(normalizedMount.length)
        .replace(/^\/+/, '');
      return rel || '.';
    }
  }
  return filePath;
}

/**
 * Extract status text from the last tool call in agent history.
 * Searches through ALL assistant messages (in reverse order) to find the
 * most recent tool part with a valid state, not just the last message.
 */
function getStatusText(
  history: AgentMessage[],
  mounts: MountEntry[] | undefined,
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
      const relativePath = relativizePath(rawPath, mounts);
      const fileName = relativePath?.split('/').pop();
      return fileName ? `Reading ${fileName}...` : 'Reading file...';
    }
    case 'tool-listFilesTool': {
      const rawPath = lastToolPart.input?.relative_path;
      const p = relativizePath(rawPath, mounts);
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
    case 'tool-overwriteFileTool': {
      return 'Writing WORKSPACE.md...';
    }
    default: {
      if (!lastMessage) return INITIALIZING_TEXT;

      const hadOverwritingWorkspaceMd = assistantMessages?.some((m) =>
        m.parts.some((p) => p.type === 'tool-overwriteFileTool'),
      );
      const lastType = lastMessage.parts.at(-1)?.type;
      if (
        (lastType === 'reasoning' || lastType === 'text') &&
        hadOverwritingWorkspaceMd
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
  workspaceMounts,
  errorMessage,
  onDismiss,
  onShowFile,
}: WorkspaceMdStatusSectionProps): StatusCardSection | null {
  if (status === 'hidden') return null;

  const isRunning = status === 'running';
  const isError = status === 'error';
  const statusText = getStatusText(history, workspaceMounts);
  return {
    key: 'project-md-status',
    defaultOpen: true,
    trigger: () => (
      <TooltipWrapper showTooltip={isRunning}>
        <div className="flex h-6 w-full flex-row items-center justify-between gap-2 pl-1.5 text-muted-foreground text-xs hover:text-foreground has-[button:hover]:text-muted-foreground">
          {isRunning ? (
            <div className="flex flex-row items-center gap-1">
              <div className="relative flex size-5 shrink-0 items-center justify-center">
                <Loader2Icon className="size-3 animate-spin text-primary-foreground" />
              </div>
              <span className="shimmer-text-primary truncate font-normal">
                Generating workspace context
              </span>
            </div>
          ) : isError ? (
            <div className="flex w-full cursor-default flex-row items-center justify-between gap-1 truncate">
              <div className="flex size-5 shrink-0 flex-row items-center justify-center">
                <XIcon className="size-3 shrink-0 text-foreground" />
              </div>
              <Tooltip>
                <TooltipTrigger>
                  <span className="truncate font-normal text-muted-foreground">
                    Context initialization failed:{' '}
                    {errorMessage ||
                      'Failed to generate .stagewise/WORKSPACE.md'}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {errorMessage || 'Failed to generate .stagewise/WORKSPACE.md'}
                </TooltipContent>
              </Tooltip>
              <div className="ml-auto flex shrink-0 flex-row items-center justify-start gap-1 pl-3">
                <Button
                  variant="ghost"
                  size="xs"
                  className="shrink-0 cursor-pointer"
                  onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    onDismiss();
                  }}
                >
                  Dismiss
                </Button>
              </div>
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
