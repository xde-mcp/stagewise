import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Switch } from '@stagewise/stage-ui/components/switch';
import {
  IconFileContentFillDuo18,
  IconPenDrawSparkleFillDuo18,
} from 'nucleo-ui-fill-duo-18';
import { SearchableSelect } from '@stagewise/stage-ui/components/searchable-select';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@stagewise/stage-ui/components/tabs';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@stagewise/stage-ui/components/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@stagewise/stage-ui/components/tooltip';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import { IdeLogo } from '@ui/components/ide-logo';
import type { OpenFilesInIde } from '@shared/karton-contracts/ui/shared-types';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { cn } from '@/utils';
import { useIsTruncated } from '@ui/hooks/use-is-truncated';
import type { ContextFilesResult } from '@shared/karton-contracts/pages-api/types';
import type {
  Patch,
  ModelProvider,
  ProviderEndpointMode,
} from '@shared/karton-contracts/ui/shared-types';
import {
  PROVIDER_DISPLAY_INFO,
  PROVIDER_OFFICIAL_URLS,
} from '@shared/karton-contracts/ui/shared-types';
import { CodeBlock } from '@ui/components/ui/code-block';
import { useScrollFadeMask } from '@ui/hooks/use-scroll-fade-mask';
import { getIDEFileUrl, IDE_SELECTION_ITEMS } from '@ui/utils';
import {
  RadioGroup,
  Radio,
  RadioLabel,
} from '@stagewise/stage-ui/components/radio';
import { Input } from '@stagewise/stage-ui/components/input';
import { Button } from '@stagewise/stage-ui/components/button';
import { produceWithPatches, enablePatches } from 'immer';
import { IconChevronRightOutline18 } from 'nucleo-ui-outline-18';
import { ChevronDownIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react';

enablePatches();

export const Route = createFileRoute('/_internal-app/agent-settings/')({
  component: Page,
  validateSearch: (search: Record<string, unknown>) => ({
    workspace: (search.workspace as string) || '',
  }),
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
  { value: 'other', label: IDE_SELECTION_ITEMS.other },
];

/** Wrapper component for code blocks with scroll fade effect and IDE edit link */
function ScrollFadeCodeBlock({
  code,
  description,
  filePath,
  muted = false,
}: {
  code: string;
  description: string;
  filePath: string | null;
  muted?: boolean;
}) {
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const viewportRef = useMemo(
    () => ({ current: viewport }),
    [viewport],
  ) as React.RefObject<HTMLElement>;

  const { maskStyle } = useScrollFadeMask(viewportRef, {
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
      <p
        className={cn(
          'text-xs',
          muted ? 'text-subtle-foreground' : 'text-muted-foreground',
        )}
      >
        {description}
      </p>
      <div
        className={cn(
          'relative overflow-hidden rounded-lg border',
          muted ? 'border-derived-subtle opacity-60' : 'border-derived',
        )}
      >
        {/* Scrollable content with OverlayScrollbar + fade mask */}
        <OverlayScrollbar
          className="mask-alpha max-h-96"
          style={
            {
              ...maskStyle,
              '--os-scrollbar-inset-top': '8px',
              '--os-scrollbar-inset-bottom': ideHref ? '24px' : '0px',
            } as React.CSSProperties
          }
          options={{
            overflow: { x: 'hidden', y: 'scroll' },
          }}
          onViewportRef={setViewport}
        >
          <CodeBlock code={code} language="markdown" className="px-2 py-2" />
        </OverlayScrollbar>
        {/* Edit in IDE badge - bottom right overlay */}
        {ideHref && (
          <a
            href={ideHref}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-0 bottom-0 flex h-6 items-center gap-1 rounded-tl-lg rounded-br-lg border-derived border-t border-l px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground dark:bg-surface-1"
          >
            <IdeLogo ide={openInIdeSelection} className="size-3" />
            <span>Open in {ideName}</span>
          </a>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Workspace Settings Section
// =============================================================================

function WorkspaceSettingsSection({ scrollReady }: { scrollReady: boolean }) {
  const { workspace: targetWorkspace } = Route.useSearch();
  const workspaceMounts = useKartonState((s) => s.workspaceMounts);
  const getContextFiles = useKartonProcedure((s) => s.getContextFiles);
  const getContextFilesRef = useRef(getContextFiles);
  getContextFilesRef.current = getContextFiles;

  const [contextFiles, setContextFiles] = useState<ContextFilesResult | null>(
    null,
  );

  const workspaceMdGenerating = useKartonState((s) => s.workspaceMdGenerating);
  const prevGeneratingRef = useRef<Record<string, boolean>>({});

  // Fetch file content whenever the set of mounted paths changes
  const mountPathsKey = useMemo(
    () => workspaceMounts.map((m) => m.path).join('\0'),
    [workspaceMounts],
  );

  useEffect(() => {
    void getContextFilesRef.current().then((files) => {
      setContextFiles(files);
    });
  }, [mountPathsKey]);

  // Re-fetch content when any workspace finishes generating
  useEffect(() => {
    const prev = prevGeneratingRef.current;
    const justFinished = Object.keys(prev).some(
      (path) => prev[path] && !workspaceMdGenerating[path],
    );
    prevGeneratingRef.current = { ...workspaceMdGenerating };

    if (justFinished) {
      void getContextFilesRef.current().then((files) => {
        setContextFiles(files);
      });
    }
  }, [workspaceMdGenerating]);

  if (workspaceMounts.length === 0) {
    return (
      <div className="rounded-lg border border-derived p-4">
        <p className="text-muted-foreground text-sm">
          No workspaces are currently connected. Connect a workspace to an agent
          to configure workspace-specific settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workspaceMounts.map((mount) => (
        <WorkspaceContextSection
          key={mount.path}
          workspacePath={mount.path}
          skills={mount.skills}
          workspaceMd={
            contextFiles?.[mount.path]?.workspaceMd ?? {
              exists: mount.workspaceMdContent !== null,
              path: null,
              content: null,
            }
          }
          agentsMd={
            contextFiles?.[mount.path]?.agentsMd ?? {
              exists: mount.agentsMdContent !== null,
              path: null,
              content: null,
            }
          }
          defaultOpen={workspaceMounts.length === 1}
          targetWorkspace={targetWorkspace}
          scrollReady={scrollReady}
        />
      ))}
    </div>
  );
}

function WorkspaceContextSection({
  workspacePath,
  skills,
  workspaceMd,
  agentsMd,
  defaultOpen,
  targetWorkspace,
  scrollReady,
}: {
  workspacePath: string;
  skills: Array<{ name: string; description: string }>;
  workspaceMd: ContextFilesResult[string]['workspaceMd'];
  agentsMd: ContextFilesResult[string]['agentsMd'];
  defaultOpen: boolean;
  targetWorkspace: string;
  scrollReady: boolean;
}) {
  const updatePreferences = useKartonProcedure((s) => s.updatePreferences);
  const generateWorkspaceMd = useKartonProcedure((s) => s.generateWorkspaceMd);
  const preferences = useKartonState((s) => s.preferences);
  const isGenerating = useKartonState(
    (s) => !!s.workspaceMdGenerating[workspacePath],
  );
  const sectionRef = useRef<HTMLDivElement>(null);
  const isTarget = targetWorkspace === workspacePath;
  const [isOpen, setIsOpen] = useState(defaultOpen || isTarget);

  useEffect(() => {
    if (isTarget && scrollReady && sectionRef.current) {
      sectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [isTarget, scrollReady]);

  const folderName = useMemo(
    () =>
      workspacePath
        .replace('\\', '/')
        .split('/')
        .filter((p) => p !== '')
        .pop() ?? workspacePath,
    [workspacePath],
  );

  const respectAgentsMd =
    preferences?.agent?.workspaceSettings?.[workspacePath]?.respectAgentsMd ??
    false;

  const disabledSkills = useMemo(
    () =>
      preferences?.agent?.workspaceSettings?.[workspacePath]?.disabledSkills ??
      [],
    [preferences, workspacePath],
  );

  const handleGenerate = useCallback(async () => {
    await generateWorkspaceMd(workspacePath);
  }, [generateWorkspaceMd, workspacePath]);

  const handleToggleAgentsMd = useCallback(
    async (checked: boolean) => {
      const currentSettings =
        preferences?.agent?.workspaceSettings?.[workspacePath];

      const patches: Patch[] = currentSettings
        ? [
            {
              op: 'replace' as const,
              path: [
                'agent',
                'workspaceSettings',
                workspacePath,
                'respectAgentsMd',
              ],
              value: checked,
            },
          ]
        : [
            {
              op: 'add' as const,
              path: ['agent', 'workspaceSettings', workspacePath],
              value: { respectAgentsMd: checked },
            },
          ];

      await updatePreferences(patches);
    },
    [workspacePath, preferences, updatePreferences],
  );

  const handleToggleSkill = useCallback(
    async (skillName: string, enabled: boolean) => {
      const currentSettings =
        preferences?.agent?.workspaceSettings?.[workspacePath];
      const current = currentSettings?.disabledSkills ?? [];
      const next = enabled
        ? current.filter((s) => s !== skillName)
        : [...current, skillName];

      const patches: Patch[] = currentSettings
        ? [
            {
              op: 'replace' as const,
              path: [
                'agent',
                'workspaceSettings',
                workspacePath,
                'disabledSkills',
              ],
              value: next,
            },
          ]
        : [
            {
              op: 'add' as const,
              path: ['agent', 'workspaceSettings', workspacePath],
              value: { respectAgentsMd: false, disabledSkills: next },
            },
          ];

      await updatePreferences(patches);
    },
    [workspacePath, preferences, updatePreferences],
  );

  const sortedSkills = useMemo(
    () => [...skills].sort((a, b) => a.name.localeCompare(b.name)),
    [skills],
  );

  const hasAnyContextFile = workspaceMd.exists || agentsMd.exists;

  const defaultTab = workspaceMd.exists ? 'workspaceMd' : 'agentsMd';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div ref={sectionRef} className="rounded-lg border border-derived">
        <CollapsibleTrigger size="default" className="px-4">
          <div className="flex min-w-0 flex-col items-start">
            <span className="font-medium text-foreground text-sm">
              {folderName}
            </span>
            <Tooltip>
              <TooltipTrigger>
                <span
                  className="max-w-80 truncate text-muted-foreground text-xs"
                  dir="rtl"
                >
                  <span dir="ltr">{workspacePath}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <span className="block max-w-80 break-all">
                  {workspacePath}
                </span>
              </TooltipContent>
            </Tooltip>
          </div>
          <ChevronDownIcon
            className={cn(
              'ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-150',
              isOpen && 'rotate-180',
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          <div className="space-y-4">
            {/* Skills */}
            <div className="space-y-2">
              <h3 className="font-medium text-foreground text-sm">Skills</h3>
              {sortedSkills.length > 0 ? (
                <div className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-derived">
                  {sortedSkills.map((skill) => {
                    const isEnabled = !disabledSkills.includes(skill.name);
                    return (
                      <div
                        key={skill.name}
                        className="flex cursor-pointer items-center gap-4 p-3"
                        onClick={() =>
                          handleToggleSkill(skill.name, !isEnabled)
                        }
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'font-medium text-sm',
                              isEnabled
                                ? 'text-foreground'
                                : 'text-muted-foreground',
                            )}
                          >
                            {skill.name}
                          </p>
                          <p
                            className={cn(
                              'text-xs',
                              isEnabled
                                ? 'text-muted-foreground'
                                : 'text-subtle-foreground',
                            )}
                          >
                            {skill.description}
                          </p>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(checked) =>
                              handleToggleSkill(skill.name, checked)
                            }
                            size="sm"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  No skills detected in this workspace.
                </p>
              )}
            </div>

            {/* Empty state: no WORKSPACE.md yet */}
            {!workspaceMd.exists && (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-derived p-6 text-center">
                <IconPenDrawSparkleFillDuo18 className="size-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground text-sm">
                    Generate workspace context
                  </p>
                  <p className="mx-auto max-w-80 text-muted-foreground text-xs leading-relaxed">
                    This will automatically analyze your project and create a
                    WORKSPACE.md file to improve agent performance.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="mt-1"
                >
                  {isGenerating && (
                    <Loader2Icon className="size-3 animate-spin" />
                  )}
                  {isGenerating ? 'Generating…' : 'Generate WORKSPACE.md'}
                </Button>
              </div>
            )}

            {/* Context files */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-foreground text-sm">
                  Context files
                </h3>
                {workspaceMd.exists && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <Loader2Icon className="size-3 animate-spin" />
                        ) : (
                          <RefreshCwIcon className="size-3" />
                        )}
                        {isGenerating ? 'Updating…' : 'Update WORKSPACE.md'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Re-analyze your project and update the WORKSPACE.md
                      context file.
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* AGENTS.md toggle */}
              <div
                className="flex cursor-pointer items-center gap-4 rounded-lg border border-derived p-3"
                onClick={() => handleToggleAgentsMd(!respectAgentsMd)}
              >
                <IconFileContentFillDuo18 className="size-5 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <h3 className="font-medium text-foreground text-sm">
                    Include AGENTS.md
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    Usually not needed — stagewise manages project context
                    automatically.
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={respectAgentsMd}
                    onCheckedChange={handleToggleAgentsMd}
                    size="sm"
                  />
                </div>
              </div>

              {hasAnyContextFile && (
                <Tabs defaultValue={defaultTab} className="w-full">
                  <TabsList className="max-w-96">
                    {workspaceMd.exists && (
                      <Tooltip>
                        <TooltipTrigger>
                          <TabsTrigger value="workspaceMd">
                            WORKSPACE.md
                          </TabsTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span className="block max-w-80 break-all">
                            {workspaceMd.path}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {agentsMd.exists && (
                      <Tooltip>
                        <TooltipTrigger>
                          <TabsTrigger
                            value="agentsMd"
                            className={
                              !respectAgentsMd
                                ? 'text-subtle-foreground'
                                : undefined
                            }
                          >
                            AGENTS.md
                          </TabsTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                          <span className="block max-w-80 break-all">
                            {agentsMd.path}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TabsList>

                  {workspaceMd.exists && (
                    <TabsContent value="workspaceMd" className="w-full">
                      <ScrollFadeCodeBlock
                        code={workspaceMd.content ?? ''}
                        description="Auto-generated project analysis stored in your project's .stagewise folder."
                        filePath={workspaceMd.path}
                      />
                    </TabsContent>
                  )}

                  {agentsMd.exists && (
                    <TabsContent value="agentsMd" className="w-full">
                      <ScrollFadeCodeBlock
                        code={agentsMd.content ?? ''}
                        description={
                          respectAgentsMd
                            ? 'User-created coding guidelines from your workspace root.'
                            : 'Not included in agent context — enable the toggle above to include.'
                        }
                        filePath={agentsMd.path}
                        muted={!respectAgentsMd}
                      />
                    </TabsContent>
                  )}
                </Tabs>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
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
      hasSetIde: true,
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
        <h3 className="font-medium text-base text-foreground">Open files in</h3>
        <p className="text-muted-foreground text-sm">
          Choose which file manager to use when opening files in the agent chat.
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
// Model Provider Configuration
// =============================================================================

const PROVIDERS: ModelProvider[] = ['anthropic', 'openai', 'google'];

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function ProviderConfigCard({ provider }: { provider: ModelProvider }) {
  const preferences = useKartonState((s) => s.preferences);
  const updatePreferences = useKartonProcedure((s) => s.updatePreferences);
  const setProviderApiKey = useKartonProcedure((s) => s.setProviderApiKey);
  const clearProviderApiKey = useKartonProcedure((s) => s.clearProviderApiKey);
  const validateProviderApiKey = useKartonProcedure(
    (s) => s.validateProviderApiKey,
  );

  const config = preferences.providerConfigs?.[provider] ?? {
    mode: 'stagewise' as const,
  };
  const displayInfo = PROVIDER_DISPLAY_INFO[provider];
  const officialUrl = PROVIDER_OFFICIAL_URLS[provider];

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validated, setValidated] = useState<
    null | { success: true } | { success: false; error: string }
  >(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const customUrlRef = useRef(config.customBaseUrl ?? '');
  const hasKey = !!config.encryptedApiKey;

  useEffect(() => {
    if (validated?.success) {
      const timer = setTimeout(() => setValidated(null), 2_000);
      return () => clearTimeout(timer);
    }
  }, [validated]);

  const handleModeChange = useCallback(
    async (newMode: string) => {
      const [, patches] = produceWithPatches(preferences, (draft) => {
        draft.providerConfigs[provider].mode = newMode as ProviderEndpointMode;
      });
      await updatePreferences(patches);
    },
    [preferences, provider, updatePreferences],
  );

  const handleCustomUrlChange = useCallback(
    async (value: string) => {
      const [, patches] = produceWithPatches(preferences, (draft) => {
        draft.providerConfigs[provider].customBaseUrl = value;
      });
      await updatePreferences(patches);
    },
    [preferences, provider, updatePreferences],
  );

  const handleSaveAndValidate = useCallback(
    async (key: string) => {
      if (!key.trim()) return;
      const trimmedKey = key.trim();

      if (config.mode === 'official') {
        setIsValidating(true);
        setValidated(null);
        try {
          const result = await validateProviderApiKey(provider, trimmedKey);
          if (result && !result.success) {
            setValidated({ success: false, error: result.error });
            return;
          }
        } catch {
          setValidated({
            success: false,
            error: 'Validation request failed. Please try again.',
          });
          return;
        } finally {
          setIsValidating(false);
        }
      } else if (config.mode === 'custom') {
        const url = customUrlRef.current.trim() || undefined;
        if (!url) {
          setUrlError('Please enter an endpoint URL.');
          return;
        }
        if (!isValidUrl(url)) {
          setUrlError('Please enter a valid URL.');
          return;
        }
        setUrlError(null);
        setIsValidating(true);
        setValidated(null);
        try {
          const result = await validateProviderApiKey(
            provider,
            trimmedKey,
            url,
          );
          if (result && !result.success) {
            setValidated({ success: false, error: result.error });
            return;
          }
        } catch {
          setValidated({
            success: false,
            error: 'Validation request failed. Please try again.',
          });
          return;
        } finally {
          setIsValidating(false);
        }
      }

      setIsSavingKey(true);
      try {
        await setProviderApiKey(provider, trimmedKey);
        setApiKeyInput('');
        setValidated({ success: true });
      } finally {
        setIsSavingKey(false);
      }
    },
    [provider, config, setProviderApiKey, validateProviderApiKey],
  );

  const handleClearApiKey = useCallback(async () => {
    await clearProviderApiKey(provider);
    setValidated(null);
  }, [provider, clearProviderApiKey]);

  const showByokFields = config.mode === 'official' || config.mode === 'custom';

  return (
    <div className="space-y-3 rounded-lg border border-derived p-4">
      <div>
        <h3 className="font-medium text-foreground text-sm">
          {displayInfo.name}
        </h3>
        <p className="text-muted-foreground text-xs">
          {displayInfo.description}
        </p>
      </div>

      <RadioGroup value={config.mode} onValueChange={handleModeChange}>
        {/* Stagewise option */}
        <RadioLabel>
          <Radio value="stagewise" />
          <span>Use my stagewise account</span>
        </RadioLabel>

        {/* Official API option */}
        <RadioLabel>
          <Radio value="official" />
          <span>Use own API key with {displayInfo.name} API</span>
        </RadioLabel>

        {/* Custom endpoint option */}
        <RadioLabel>
          <Radio value="custom" />
          <span>Use own API key with custom endpoint</span>
        </RadioLabel>
      </RadioGroup>

      {/* BYOK fields: URL + API Key in responsive grid */}
      {showByokFields && (
        <div className="grid grid-cols-1 gap-3 border-derived border-t pt-3 sm:grid-cols-2">
          {/* Endpoint URL */}
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-xs">
              Endpoint URL
            </p>
            <Input
              value={
                config.mode === 'custom'
                  ? (config.customBaseUrl ?? '')
                  : officialUrl
              }
              placeholder="https://your-proxy.example.com/v1"
              onValueChange={
                config.mode === 'custom'
                  ? (v) => {
                      customUrlRef.current = v;
                      setUrlError(null);
                      void handleCustomUrlChange(v);
                    }
                  : undefined
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && apiKeyInput.trim()) {
                  void handleSaveAndValidate(apiKeyInput);
                }
              }}
              disabled={
                config.mode === 'official' || isValidating || isSavingKey
              }
              size="sm"
              style={{ maxWidth: 'none' }}
              debounce={400}
            />
            {urlError && config.mode === 'custom' && (
              <p className="text-2xs text-error-foreground">{urlError}</p>
            )}
          </div>

          {/* API Key */}
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-xs">
              API Key
              {isValidating && (
                <span className="ml-1.5 font-normal text-subtle-foreground">
                  validating...
                </span>
              )}
              {!isValidating && validated?.success && (
                <span className="ml-1.5 font-normal text-success-foreground">
                  Updated
                </span>
              )}
            </p>
            <div className="flex gap-1.5">
              <Input
                type="password"
                value={apiKeyInput}
                placeholder={
                  hasKey || validated
                    ? '••••••••••••••••••••••••••••••••'
                    : 'Enter API key...'
                }
                onValueChange={(v) => {
                  setApiKeyInput(v);
                  setValidated(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && apiKeyInput.trim()) {
                    void handleSaveAndValidate(apiKeyInput);
                  }
                }}
                onBlur={() => {
                  if (!apiKeyInput.trim()) return;
                  if (
                    config.mode === 'custom' &&
                    (!customUrlRef.current.trim() ||
                      !isValidUrl(customUrlRef.current.trim()))
                  ) {
                    return;
                  }
                  void handleSaveAndValidate(apiKeyInput);
                }}
                disabled={isValidating || isSavingKey}
                size="sm"
                style={{ maxWidth: 'none' }}
                className="min-w-0 flex-1"
              />
              {apiKeyInput ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleSaveAndValidate(apiKeyInput)}
                  disabled={isValidating || isSavingKey}
                >
                  Save
                </Button>
              ) : hasKey ? (
                <Button variant="ghost" size="sm" onClick={handleClearApiKey}>
                  Clear
                </Button>
              ) : null}
            </div>
            {validated && !validated.success && (
              <TruncatedErrorText text={validated.error} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ModelProvidersSection() {
  return (
    <div className="space-y-3">
      {PROVIDERS.map((provider) => (
        <ProviderConfigCard key={provider} provider={provider} />
      ))}
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

function Page() {
  const navigate = useNavigate();
  const [scrollReady, setScrollReady] = useState(false);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-center border-derived border-b px-6 py-4">
        <div className="mx-auto w-full max-w-4xl">
          <h1 className="font-semibold text-foreground text-xl">
            Agent Settings
          </h1>
        </div>
      </div>

      {/* Content */}
      <OverlayScrollbar
        className="flex-1"
        contentClassName="px-6 pt-6 pb-24"
        onInitialized={() => setScrollReady(true)}
      >
        <div className="mx-auto max-w-4xl space-y-8">
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

          <hr className="border-derived-subtle border-t" />

          {/* Models & Providers Section */}
          <section className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-medium text-foreground text-lg">
                  Models & Providers
                </h2>
                <p className="text-muted-foreground text-sm">
                  Configure how the agent connects to LLM providers. Use your
                  stagewise account, official provider endpoints, or custom
                  URLs.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    navigate({ to: '/agent-settings/custom-providers' })
                  }
                >
                  Custom Providers
                  <IconChevronRightOutline18 className="size-3" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate({ to: '/agent-settings/models' })}
                >
                  Models
                  <IconChevronRightOutline18 className="size-3" />
                </Button>
              </div>
            </div>

            <ModelProvidersSection />
          </section>

          <hr className="border-derived-subtle border-t" />

          {/* Workspace Settings Section */}
          <section className="space-y-6">
            <div>
              <h2 className="font-medium text-foreground text-lg">
                Workspace Settings
              </h2>
              <p className="text-muted-foreground text-sm">
                Per-workspace configuration and context files for the AI agent.
              </p>
            </div>

            <WorkspaceSettingsSection scrollReady={scrollReady} />
          </section>
        </div>
      </OverlayScrollbar>
    </div>
  );
}

function TruncatedErrorText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { isTruncated, tooltipOpen, setTooltipOpen } = useIsTruncated(ref);

  return (
    <Tooltip open={isTruncated && tooltipOpen} onOpenChange={setTooltipOpen}>
      <TooltipTrigger>
        <p ref={ref} className={cn('truncate text-2xs text-error-foreground')}>
          {text}
        </p>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start">
        <div className="wrap-break-word line-clamp-12 max-h-48 max-w-xs overflow-y-auto text-2xs leading-relaxed">
          {text}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
