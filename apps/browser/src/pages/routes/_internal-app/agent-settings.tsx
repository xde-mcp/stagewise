import { createFileRoute } from '@tanstack/react-router';
import { SearchableSelect } from '@stagewise/stage-ui/components/searchable-select';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@stagewise/stage-ui/components/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import { IdeLogo } from '@ui/components/ide-logo';
import type { OpenFilesInIde } from '@shared/karton-contracts/ui/shared-types';
import { useEffect, useState, useRef } from 'react';
import type { ContextFilesResult } from '@shared/karton-contracts/pages-api/types';
import { CodeBlock } from '@ui/components/ui/code-block';
import { useScrollFadeMask } from '@ui/hooks/use-scroll-fade-mask';
import { getIDEFileUrl, IDE_SELECTION_ITEMS } from '@ui/utils';

export const Route = createFileRoute('/_internal-app/agent-settings')({
  component: Page,
  head: () => ({
    meta: [
      {
        title: 'Agent Settings',
      },
    ],
  }),
});

// =============================================================================
// IDE Selection Setting Component
// =============================================================================

/** IDE options with Cursor first, then alphabetical */
const IDE_OPTIONS: { value: OpenFilesInIde; label: string }[] = [
  { value: 'cursor', label: 'Cursor' },
  { value: 'zed', label: 'Zed' },
  { value: 'vscode', label: 'VS Code' },
  { value: 'kiro', label: 'Kiro' },
  { value: 'windsurf', label: 'Windsurf' },
  { value: 'trae', label: 'Trae' },
  { value: 'other', label: 'Other' },
];

/** Wrapper component for code blocks with scroll fade effect and IDE edit link */
function ScrollFadeCodeBlock({
  code,
  description,
  filePath,
}: {
  code: string;
  description: string;
  filePath: string | null;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { maskStyle } = useScrollFadeMask(scrollContainerRef, {
    axis: 'vertical',
    fadeDistance: 24,
  });
  const openInIdeSelection = useKartonState(
    (s) => s.globalConfig.openFilesInIde,
  );

  const ideHref = filePath ? getIDEFileUrl(filePath, openInIdeSelection) : null;
  const ideName = IDE_SELECTION_ITEMS[openInIdeSelection];

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">{description}</p>
      {/* Outer container for border - not affected by mask */}
      <div className="relative overflow-hidden rounded-lg border border-derived bg-background">
        {/* Inner container for scroll + fade mask */}
        <div
          ref={scrollContainerRef}
          className="mask-alpha scrollbar-hover-only max-h-96 overflow-auto"
          style={maskStyle}
        >
          <CodeBlock code={code} language="markdown" className="px-2 py-2" />
        </div>
        {/* Edit in IDE badge - bottom right overlay */}
        {ideHref && (
          <a
            href={ideHref}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-0 bottom-0 flex h-6 items-center gap-1 rounded-tl-lg rounded-br-lg border-derived border-t border-l bg-background px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground dark:bg-surface-1"
          >
            <IdeLogo ide={openInIdeSelection} className="size-3" />
            <span>Edit in {ideName}</span>
          </a>
        )}
      </div>
    </div>
  );
}

function ContextFilesSetting() {
  const getContextFiles = useKartonProcedure((s) => s.getContextFiles);
  const [contextFiles, setContextFiles] = useState<ContextFilesResult | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void getContextFiles()
      .then((files) => {
        setContextFiles(files);
      })
      .catch((error) => {
        console.error('Failed to load context files:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [getContextFiles]);

  if (isLoading) {
    return (
      <div className="text-muted-foreground text-sm">
        Loading context files...
      </div>
    );
  }

  if (!contextFiles?.workspaceLoaded) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
        <p className="text-muted-foreground text-sm">
          No workspace is currently open. Open a workspace to view context
          files.
        </p>
      </div>
    );
  }

  const hasAnyContextFile =
    contextFiles.projectMd.exists || contextFiles.agentsMd.exists;

  if (!hasAnyContextFile) {
    return (
      <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
        <p className="text-muted-foreground text-sm">
          No context files found in the current workspace.
        </p>
      </div>
    );
  }

  // Determine default tab - prefer .stagewise/PROJECT.md if it exists
  const defaultTab = contextFiles.projectMd.exists ? 'project' : 'agents';

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="max-w-96">
        {contextFiles.projectMd.exists && (
          <Tooltip>
            <TooltipTrigger>
              <TabsTrigger value="project">PROJECT.md</TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <span className="block max-w-80 break-all">
                {contextFiles.projectMd.path}
              </span>
            </TooltipContent>
          </Tooltip>
        )}
        {contextFiles.agentsMd.exists && (
          <Tooltip>
            <TooltipTrigger>
              <TabsTrigger value="agents">AGENTS.md</TabsTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <span className="block max-w-80 break-all">
                {contextFiles.agentsMd.path}
              </span>
            </TooltipContent>
          </Tooltip>
        )}
      </TabsList>

      {contextFiles.projectMd.exists && (
        <TabsContent value="project" className="w-full">
          <ScrollFadeCodeBlock
            code={contextFiles.projectMd.content ?? ''}
            description="Auto-generated project analysis stored in your project's .stagewise folder."
            filePath={contextFiles.projectMd.path}
          />
        </TabsContent>
      )}

      {contextFiles.agentsMd.exists && (
        <TabsContent value="agents" className="w-full">
          <ScrollFadeCodeBlock
            code={contextFiles.agentsMd.content ?? ''}
            description="User-created coding guidelines from your workspace root."
            filePath={contextFiles.agentsMd.path}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
function IdeSelectionSetting() {
  const globalConfig = useKartonState((s) => s.globalConfig);
  const setGlobalConfig = useKartonProcedure((s) => s.setGlobalConfig);

  const currentIde = globalConfig.openFilesInIde;

  const handleIdeChange = async (value: string) => {
    await setGlobalConfig({
      ...globalConfig,
      openFilesInIde: value as OpenFilesInIde,
    });
  };

  const selectItems = IDE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    triggerLabel: (
      <div className="flex items-center gap-2">
        <IdeLogo ide={option.value} className="size-4" />
        {option.label}
      </div>
    ),
    icon: <IdeLogo ide={option.value} className="size-4" />,
    searchText: option.label,
  }));

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h3 className="font-medium text-base text-foreground">Preferred IDE</h3>
        <p className="text-muted-foreground text-sm">
          Choose which IDE to use when opening files from the agent chat.
        </p>
      </div>

      <SearchableSelect
        value={currentIde}
        onValueChange={handleIdeChange}
        items={selectItems}
        triggerVariant="secondary"
        size="xs"
        triggerClassName="w-auto min-w-0 px-2 py-3"
        side="bottom"
      />
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

function Page() {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-center border-border/30 border-b px-6 py-4">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="font-semibold text-foreground text-xl">
            Agent Settings
          </h1>
        </div>
      </div>

      {/* Content */}
      <OverlayScrollbar className="flex-1" contentClassName="p-6">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Editor Section */}
          <section className="space-y-6">
            <div>
              <h2 className="font-medium text-foreground text-lg">Editor</h2>
              <p className="text-muted-foreground text-sm">
                Configure how the agent interacts with your development
                environment.
              </p>
            </div>

            <IdeSelectionSetting />
          </section>
          <section id="context-files" className="mt-6 space-y-2">
            <div>
              <h2 className="font-medium text-foreground text-lg">Context</h2>
              <p className="text-muted-foreground text-sm">
                Files that provide project-specific context to the AI agent.
              </p>
            </div>

            <ContextFilesSetting />
          </section>
        </div>
      </OverlayScrollbar>
    </div>
  );
}
