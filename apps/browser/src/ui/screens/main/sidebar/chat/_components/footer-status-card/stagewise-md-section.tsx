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
import type { ToolUIPart } from 'ai';
import type { StagewiseUITools } from '@shared/karton-contracts/ui/agent/tools/types';

export type StagewiseMdStatus = 'hidden' | 'running' | 'completed';

export interface StagewiseMdStatusSectionProps {
  status: StagewiseMdStatus;
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
 * Extract status text from the last tool call in agent history
 */
function getStatusText(
  history: AgentMessage[],
  workspacePath: string | null | undefined,
): string {
  const INITIALIZING_TEXT = 'Initializing STAGEWISE.md...';
  const ANALYZING_TEXT = 'Analyzing workspace...';
  const lastMessage = history?.filter((m) => m.role === 'assistant').at(-1);

  const lastToolPart = (
    lastMessage?.parts.filter((p) =>
      p.type.startsWith('tool-'),
    ) as ToolUIPart<StagewiseUITools>[]
  )
    ?.filter(
      (p) => p.state === 'input-available' || p.state === 'output-available',
    )
    ?.at(-1);

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
    case 'tool-writeStagewiseMdTool': {
      return 'Writing STAGEWISE.md...';
    }
    default: {
      if (!lastMessage) return INITIALIZING_TEXT;

      const hadWritingStagewiseMd = lastMessage.parts.some(
        (p) => p.type === 'tool-writeStagewiseMdTool',
      );
      const lastType = lastMessage.parts.at(-1)?.type;
      if (
        (lastType === 'reasoning' || lastType === 'text') &&
        hadWritingStagewiseMd
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
        Initializing STAGEWISE.md for frontend-aware context.
      </TooltipContent>
    </Tooltip>
  );
}

export function StagewiseMdStatusSection({
  status,
  history,
  workspacePath,
  onDismiss,
  onShowFile,
}: StagewiseMdStatusSectionProps): StatusCardSection | null {
  if (status === 'hidden') return null;

  const isRunning = status === 'running';
  const statusText = getStatusText(history, workspacePath);
  return {
    key: 'stagewise-md-status',
    defaultOpen: true,
    trigger: () => (
      <TooltipWrapper showTooltip={isRunning}>
        <div className="flex h-6 w-full cursor-default! flex-row items-center justify-between gap-2 pl-1.5 text-muted-foreground text-xs hover:text-foreground has-[button:hover]:text-muted-foreground">
          {isRunning ? (
            <div className="flex flex-row items-center gap-2">
              <div className="relative flex size-3 shrink-0 items-center justify-center">
                <Loader2Icon className="size-3 animate-spin text-primary-foreground" />
              </div>
              <span className="shimmer-text-primary truncate font-normal">
                {statusText}
              </span>
            </div>
          ) : (
            <>
              <div className="flex flex-row items-center gap-1">
                <FileIcon filePath="STAGEWISE.md" className="size-5 shrink-0" />
                <span className="text-foreground text-xs leading-none">
                  STAGEWISE.md
                </span>
                <span className="font-normal text-muted-foreground">
                  generated
                </span>
              </div>
              <div className="ml-auto flex flex-row items-center justify-start gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  className="cursor-pointer"
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
                  className="cursor-pointer"
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
    contentClassName: 'px-1.5 pb-1',
    content: undefined,
  };
}
