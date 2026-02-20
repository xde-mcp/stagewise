import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Switch } from '@stagewise/stage-ui/components/switch';
import { IconFileContentFillDuo18 } from 'nucleo-ui-fill-duo-18';
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
import {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
  useLayoutEffect,
} from 'react';
import { cn } from '@/utils';
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

enablePatches();

export const Route = createFileRoute('/_internal-app/agent-settings/')({
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
  { value: 'other', label: IDE_SELECTION_ITEMS.other },
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
      <p className="text-muted-foreground text-xs">{description}</p>
      {/* Outer container for border - not affected by mask */}
      <div className="relative overflow-hidden rounded-lg border border-derived">
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

function WorkspaceSettingsSection() {
  const getContextFiles = useKartonProcedure((s) => s.getContextFiles);
  const updatePreferences = useKartonProcedure((s) => s.updatePreferences);
  const preferences = useKartonState((s) => s.preferences);

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

  const workspacePath = contextFiles?.workspacePath ?? null;

  const respectAgentsMd = workspacePath
    ? (preferences?.agent?.workspaceSettings?.[workspacePath]
        ?.respectAgentsMd ?? false)
    : false;

  const handleToggleAgentsMd = useCallback(
    async (checked: boolean) => {
      if (!workspacePath) return;

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

  if (isLoading) {
    return (
      <div className="text-muted-foreground text-sm">
        Loading workspace settings...
      </div>
    );
  }

  if (!contextFiles?.workspaceLoaded) {
    return (
      <div className="rounded-lg border border-derived p-4">
        <p className="text-muted-foreground text-sm">
          No workspace is currently open. Open a workspace to configure
          workspace-specific settings.
        </p>
      </div>
    );
  }

  const showAgentsMd = respectAgentsMd && contextFiles.agentsMd.exists;
  const hasAnyContextFile = contextFiles.workspaceMd.exists || showAgentsMd;

  // Determine default tab - prefer .stagewise/ if it exists
  const defaultTab = contextFiles.workspaceMd.exists
    ? 'workspaceMd'
    : 'agentsMd';

  return (
    <div className="space-y-6">
      {/* AGENTS.md toggle */}
      <div
        className="flex cursor-pointer items-center gap-4 rounded-lg border border-derived p-4"
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

      {/* Context files viewer */}
      {hasAnyContextFile && (
        <div className="space-y-2">
          <h3 className="font-medium text-base text-foreground">
            Context files
          </h3>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="max-w-96">
              {contextFiles.workspaceMd.exists && (
                <Tooltip>
                  <TooltipTrigger>
                    <TabsTrigger value="workspaceMd">WORKSPACE.md</TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="block max-w-80 break-all">
                      {contextFiles.workspaceMd.path}
                    </span>
                  </TooltipContent>
                </Tooltip>
              )}
              {showAgentsMd && (
                <Tooltip>
                  <TooltipTrigger>
                    <TabsTrigger value="agentsMd">AGENTS.md</TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="block max-w-80 break-all">
                      {contextFiles.agentsMd.path}
                    </span>
                  </TooltipContent>
                </Tooltip>
              )}
            </TabsList>

            {contextFiles.workspaceMd.exists && (
              <TabsContent value="workspaceMd" className="w-full">
                <ScrollFadeCodeBlock
                  code={contextFiles.workspaceMd.content ?? ''}
                  description="Auto-generated project analysis stored in your project's .stagewise folder."
                  filePath={contextFiles.workspaceMd.path}
                />
              </TabsContent>
            )}

            {showAgentsMd && (
              <TabsContent value="agentsMd" className="w-full">
                <ScrollFadeCodeBlock
                  code={contextFiles.agentsMd.content ?? ''}
                  description="User-created coding guidelines from your workspace root."
                  filePath={contextFiles.agentsMd.path}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}
    </div>
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
      <OverlayScrollbar className="flex-1" contentClassName="p-6">
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

            <WorkspaceSettingsSection />
          </section>
        </div>
      </OverlayScrollbar>
    </div>
  );
}

function isTextTruncated(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  return el.scrollWidth > el.clientWidth;
}

function TruncatedErrorText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => setIsTruncated(isTextTruncated(el));
    check();

    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

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
