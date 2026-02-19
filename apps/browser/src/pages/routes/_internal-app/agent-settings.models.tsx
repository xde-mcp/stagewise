import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import { useEffect, useState, useMemo, useCallback } from 'react';
import type {
  CustomEndpoint,
  CustomModel,
  ModelCapabilities,
} from '@shared/karton-contracts/ui/shared-types';
import { PROVIDER_DISPLAY_INFO } from '@shared/karton-contracts/ui/shared-types';
import { availableModels } from '@shared/available-models';
import { Input } from '@stagewise/stage-ui/components/input';
import { Button } from '@stagewise/stage-ui/components/button';
import { Select } from '@stagewise/stage-ui/components/select';
import { Switch } from '@stagewise/stage-ui/components/switch';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogHeader,
  DialogFooter,
} from '@stagewise/stage-ui/components/dialog';
import { produceWithPatches, enablePatches } from 'immer';
import {
  IconPlusOutline18,
  IconPenOutline18,
  IconTrashOutline18,
  IconChevronDownOutline18,
  IconChevronLeftOutline18,
} from 'nucleo-ui-outline-18';

enablePatches();

export const Route = createFileRoute('/_internal-app/agent-settings/models')({
  component: Page,
  head: () => ({
    meta: [
      {
        title: 'Models',
      },
    ],
  }),
});

// =============================================================================
// Model Components
// =============================================================================

const BUILT_IN_MODEL_IDS = new Set(
  availableModels.map((m) => m.modelId),
) as Set<string>;

function CustomModelDialog({
  model,
  open,
  onOpenChange,
  onSave,
  existingModelIds,
  customEndpoints,
}: {
  model?: CustomModel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    data: Omit<CustomModel, 'providerOptions' | 'headers'> & {
      providerOptions: Record<string, unknown>;
      headers: Record<string, string>;
    },
  ) => void;
  existingModelIds: Set<string>;
  customEndpoints: CustomEndpoint[];
}) {
  const [modelId, setModelId] = useState(model?.modelId ?? '');
  const [displayName, setDisplayName] = useState(model?.displayName ?? '');
  const [description, setDescription] = useState(model?.description ?? '');
  const [contextWindowSize, setContextWindowSize] = useState(
    model?.contextWindowSize ?? 128000,
  );
  const [endpointId, setEndpointId] = useState(model?.endpointId ?? 'openai');
  const [thinkingEnabled, setThinkingEnabled] = useState(
    model?.thinkingEnabled ?? false,
  );
  const defaultCaps: ModelCapabilities = {
    inputModalities: {
      text: true,
      audio: false,
      image: false,
      video: false,
      file: false,
    },
    outputModalities: {
      text: true,
      audio: false,
      image: false,
      video: false,
      file: false,
    },
    toolCalling: true,
    intelligence: { canPlan: true, canCode: true },
  };
  const [capabilities, setCapabilities] = useState<ModelCapabilities>(
    model?.capabilities ?? defaultCaps,
  );
  const [providerOptionsJson, setProviderOptionsJson] = useState(
    model?.providerOptions && Object.keys(model.providerOptions).length > 0
      ? JSON.stringify(model.providerOptions, null, 2)
      : '',
  );
  const [headersJson, setHeadersJson] = useState(
    model?.headers && Object.keys(model.headers).length > 0
      ? JSON.stringify(model.headers, null, 2)
      : '',
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setModelId(model?.modelId ?? '');
      setDisplayName(model?.displayName ?? '');
      setDescription(model?.description ?? '');
      setContextWindowSize(model?.contextWindowSize ?? 128000);
      setEndpointId(model?.endpointId ?? 'openai');
      setThinkingEnabled(model?.thinkingEnabled ?? false);
      setCapabilities(model?.capabilities ?? defaultCaps);
      setProviderOptionsJson(
        model?.providerOptions && Object.keys(model.providerOptions).length > 0
          ? JSON.stringify(model.providerOptions, null, 2)
          : '',
      );
      setHeadersJson(
        model?.headers && Object.keys(model.headers).length > 0
          ? JSON.stringify(model.headers, null, 2)
          : '',
      );
      setShowAdvanced(false);
      setJsonError(null);
    }
  }, [open, model]);

  const endpointOptions = useMemo(() => {
    const builtIn = [
      { value: 'anthropic', label: 'Anthropic', group: 'Built-in' },
      { value: 'openai', label: 'OpenAI', group: 'Built-in' },
      { value: 'google', label: 'Google', group: 'Built-in' },
    ];
    const custom = customEndpoints.map((ep) => ({
      value: ep.id,
      label: ep.name,
      group: 'Custom',
    }));
    return [...builtIn, ...custom];
  }, [customEndpoints]);

  const isDuplicate =
    modelId.trim().length > 0 &&
    (BUILT_IN_MODEL_IDS.has(modelId.trim()) ||
      (existingModelIds.has(modelId.trim()) &&
        modelId.trim() !== model?.modelId));

  const canSave =
    modelId.trim().length > 0 &&
    displayName.trim().length > 0 &&
    !isDuplicate &&
    !jsonError;

  const handleSave = () => {
    let providerOptions: Record<string, unknown> = {};
    let headers: Record<string, string> = {};

    if (providerOptionsJson.trim()) {
      try {
        providerOptions = JSON.parse(providerOptionsJson);
      } catch {
        setJsonError('Invalid JSON in Provider Options');
        return;
      }
    }
    if (headersJson.trim()) {
      try {
        headers = JSON.parse(headersJson);
      } catch {
        setJsonError('Invalid JSON in Headers');
        return;
      }
    }

    onSave({
      modelId: modelId.trim(),
      displayName: displayName.trim(),
      description: description.trim(),
      contextWindowSize,
      endpointId,
      thinkingEnabled,
      capabilities,
      providerOptions,
      headers,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogClose />
        <DialogHeader>
          <DialogTitle>{model ? 'Edit Model' : 'Add Custom Model'}</DialogTitle>
          <DialogDescription>
            Define a model and assign it to a provider or custom endpoint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="font-medium text-foreground text-xs">Model ID</p>
            <Input
              placeholder="gpt-4o-mini"
              value={modelId}
              onValueChange={(val) => {
                setModelId(val);
                setJsonError(null);
              }}
              size="sm"
            />
            {isDuplicate && (
              <p className="text-red-500 text-xs">
                This model ID already exists.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-foreground text-xs">Display Name</p>
            <Input
              placeholder="GPT-4o Mini"
              value={displayName}
              onValueChange={setDisplayName}
              size="sm"
            />
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-foreground text-xs">
              Description{' '}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </p>
            <Input
              placeholder="A fast, affordable model..."
              value={description}
              onValueChange={setDescription}
              size="sm"
            />
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-foreground text-xs">
              Context Window
            </p>
            <Input
              type="number"
              value={String(contextWindowSize)}
              onValueChange={(val) =>
                setContextWindowSize(Number.parseInt(val, 10) || 128000)
              }
              size="sm"
            />
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-foreground text-xs">Endpoint</p>
            <Select
              value={endpointId}
              onValueChange={(val) => setEndpointId(val as string)}
              items={endpointOptions}
              size="sm"
              triggerClassName="w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="font-medium text-foreground text-xs">
              Thinking Enabled
            </p>
            <Switch
              checked={thinkingEnabled}
              onCheckedChange={setThinkingEnabled}
              size="xs"
            />
          </div>

          {/* Capabilities */}
          <div className="space-y-3 border-derived border-t pt-3">
            <p className="font-medium text-foreground text-xs">Capabilities</p>

            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs">Tool Calling</p>
              <Switch
                checked={capabilities.toolCalling}
                onCheckedChange={(v) =>
                  setCapabilities((c) => ({ ...c, toolCalling: v }))
                }
                size="xs"
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs">Can Plan</p>
              <Switch
                checked={capabilities.intelligence.canPlan}
                onCheckedChange={(v) =>
                  setCapabilities((c) => ({
                    ...c,
                    intelligence: { ...c.intelligence, canPlan: v },
                  }))
                }
                size="xs"
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-xs">Can Code</p>
              <Switch
                checked={capabilities.intelligence.canCode}
                onCheckedChange={(v) =>
                  setCapabilities((c) => ({
                    ...c,
                    intelligence: { ...c.intelligence, canCode: v },
                  }))
                }
                size="xs"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs">Input Modalities</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {(['text', 'image', 'audio', 'video', 'file'] as const).map(
                  (mod) => (
                    <div
                      key={mod}
                      className="flex items-center gap-1.5 text-muted-foreground text-xs"
                    >
                      <Switch
                        checked={capabilities.inputModalities[mod]}
                        onCheckedChange={(v) =>
                          setCapabilities((c) => ({
                            ...c,
                            inputModalities: {
                              ...c.inputModalities,
                              [mod]: v,
                            },
                          }))
                        }
                        size="xs"
                      />
                      {mod}
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs">Output Modalities</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {(['text', 'image', 'audio', 'video', 'file'] as const).map(
                  (mod) => (
                    <div
                      key={mod}
                      className="flex items-center gap-1.5 text-muted-foreground text-xs"
                    >
                      <Switch
                        checked={capabilities.outputModalities[mod]}
                        onCheckedChange={(v) =>
                          setCapabilities((c) => ({
                            ...c,
                            outputModalities: {
                              ...c.outputModalities,
                              [mod]: v,
                            },
                          }))
                        }
                        size="xs"
                      />
                      {mod}
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>

          <div className="border-derived border-t pt-3">
            <button
              type="button"
              className="flex w-full items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <IconChevronDownOutline18
                className={`size-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              />
              Advanced
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <p className="font-medium text-foreground text-xs">
                    Provider Options (JSON)
                  </p>
                  <textarea
                    className="w-full rounded-lg border border-derived bg-background p-2 font-mono text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-muted-foreground/35"
                    rows={3}
                    placeholder='{"reasoningEffort": "high"}'
                    value={providerOptionsJson}
                    onChange={(e) => {
                      setProviderOptionsJson(e.target.value);
                      setJsonError(null);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="font-medium text-foreground text-xs">
                    Headers (JSON)
                  </p>
                  <textarea
                    className="w-full rounded-lg border border-derived bg-background p-2 font-mono text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-muted-foreground/35"
                    rows={3}
                    placeholder='{"x-custom-header": "value"}'
                    value={headersJson}
                    onChange={(e) => {
                      setHeadersJson(e.target.value);
                      setJsonError(null);
                    }}
                  />
                </div>
                {jsonError && (
                  <p className="text-red-500 text-xs">{jsonError}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="primary"
            size="sm"
            disabled={!canSave}
            onClick={handleSave}
          >
            {model ? 'Save Changes' : 'Add Model'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BuiltInModelCard({
  model,
}: {
  model: (typeof availableModels)[number];
}) {
  return (
    <div className="rounded-lg border border-derived bg-surface-1 p-4 opacity-70">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-foreground text-sm">
            {model.modelDisplayName}
          </h3>
          <p className="text-muted-foreground text-xs">
            {model.modelId} &middot;{' '}
            {PROVIDER_DISPLAY_INFO[model.provider].name} &middot;{' '}
            {model.modelContext}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          Built-in
        </span>
      </div>
    </div>
  );
}

function CustomModelCard({
  model,
  endpointName,
  onEdit,
  onDelete,
}: {
  model: CustomModel;
  endpointName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-derived bg-surface-1 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-foreground text-sm">
            {model.displayName}
          </h3>
          <p className="truncate text-muted-foreground text-xs">
            {model.modelId} &middot; {endpointName} &middot;{' '}
            {Math.round(model.contextWindowSize / 1000)}k context
          </p>
          {model.description && (
            <p className="mt-0.5 truncate text-muted-foreground/70 text-xs">
              {model.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={onEdit}>
            <IconPenOutline18 className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onDelete}>
            <IconTrashOutline18 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CustomModelsSection() {
  const preferences = useKartonState((s) => s.preferences);
  const updatePreferences = useKartonProcedure((s) => s.updatePreferences);

  const customModels = preferences?.customModels ?? [];
  const customEndpoints = preferences?.customEndpoints ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<CustomModel | undefined>(
    undefined,
  );

  const existingModelIds = useMemo(
    () => new Set(customModels.map((m) => m.modelId)),
    [customModels],
  );

  const resolveEndpointName = useCallback(
    (endpointId: string) => {
      if (endpointId === 'anthropic') return 'Anthropic';
      if (endpointId === 'openai') return 'OpenAI';
      if (endpointId === 'google') return 'Google';
      return (
        customEndpoints.find((ep) => ep.id === endpointId)?.name ?? 'Unknown'
      );
    },
    [customEndpoints],
  );

  const handleAdd = useCallback(() => {
    setEditingModel(undefined);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((m: CustomModel) => {
    setEditingModel(m);
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(
    async (
      data: Omit<CustomModel, 'providerOptions' | 'headers'> & {
        providerOptions: Record<string, unknown>;
        headers: Record<string, string>;
      },
    ) => {
      if (editingModel) {
        const idx = customModels.findIndex(
          (m) => m.modelId === editingModel.modelId,
        );
        if (idx === -1) return;
        const [, patches] = produceWithPatches(preferences, (draft) => {
          draft.customModels[idx] = data;
        });
        await updatePreferences(patches);
      } else {
        const [, patches] = produceWithPatches(preferences, (draft) => {
          draft.customModels.push(data);
        });
        await updatePreferences(patches);
      }
    },
    [editingModel, customModels, preferences, updatePreferences],
  );

  const handleDelete = useCallback(
    async (modelId: string) => {
      const [, patches] = produceWithPatches(preferences, (draft) => {
        const idx = draft.customModels.findIndex((m) => m.modelId === modelId);
        if (idx !== -1) {
          draft.customModels.splice(idx, 1);
        }
      });
      await updatePreferences(patches);
    },
    [preferences, updatePreferences],
  );

  return (
    <div className="space-y-3">
      {/* Built-in models (read-only) */}
      {availableModels.map((model) => (
        <BuiltInModelCard key={model.modelId} model={model} />
      ))}

      {/* Custom models */}
      {customModels.map((model) => (
        <CustomModelCard
          key={model.modelId}
          model={model}
          endpointName={resolveEndpointName(model.endpointId)}
          onEdit={() => handleEdit(model)}
          onDelete={() => handleDelete(model.modelId)}
        />
      ))}

      <Button variant="secondary" size="sm" onClick={handleAdd}>
        <IconPlusOutline18 className="size-3.5" />
        Add Model
      </Button>

      <CustomModelDialog
        model={editingModel}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        existingModelIds={existingModelIds}
        customEndpoints={customEndpoints}
      />
    </div>
  );
}

// =============================================================================
// Page Component
// =============================================================================

function Page() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-center border-border/30 border-b px-6 py-4">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate({ to: '/agent-settings' })}
          >
            <IconChevronLeftOutline18 className="size-4" />
          </Button>
          <div className="flex flex-col">
            <h1 className="font-semibold text-foreground text-xl">Models</h1>
            <span className="text-muted-foreground text-sm">
              Built-in models are shown for reference. Define additional models
              that use built-in providers or custom endpoints.
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <OverlayScrollbar className="flex-1" contentClassName="p-6">
        <div className="mx-auto max-w-3xl">
          <CustomModelsSection />
        </div>
      </OverlayScrollbar>
    </div>
  );
}
