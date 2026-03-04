import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import { useEffect, useState, useCallback } from 'react';
import type {
  ApiSpec,
  CustomEndpoint,
} from '@shared/karton-contracts/ui/shared-types';
import { Input } from '@stagewise/stage-ui/components/input';
import { Button } from '@stagewise/stage-ui/components/button';
import { Select } from '@stagewise/stage-ui/components/select';
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
  IconChevronLeftOutline18,
} from 'nucleo-ui-outline-18';

enablePatches();

export const Route = createFileRoute(
  '/_internal-app/agent-settings/custom-providers',
)({
  component: Page,
  head: () => ({
    meta: [
      {
        title: 'Custom Providers',
      },
    ],
  }),
});

// =============================================================================
// Custom Endpoint Components
// =============================================================================

const API_SPEC_OPTIONS: { value: ApiSpec; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai-chat-completions', label: 'OpenAI (Chat Completions)' },
  { value: 'openai-responses', label: 'OpenAI (Responses)' },
  { value: 'google', label: 'Google' },
];

function CustomEndpointDialog({
  endpoint,
  open,
  onOpenChange,
  onSave,
}: {
  endpoint?: CustomEndpoint;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    name: string;
    apiSpec: ApiSpec;
    baseUrl: string;
    apiKey: string;
  }) => void;
}) {
  const [name, setName] = useState(endpoint?.name ?? '');
  const [apiSpec, setApiSpec] = useState<ApiSpec>(
    endpoint?.apiSpec ?? 'openai-chat-completions',
  );
  const [baseUrl, setBaseUrl] = useState(endpoint?.baseUrl ?? '');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (open) {
      setName(endpoint?.name ?? '');
      setApiSpec(endpoint?.apiSpec ?? 'openai-chat-completions');
      setBaseUrl(endpoint?.baseUrl ?? '');
      setApiKey('');
    }
  }, [open, endpoint]);

  const canSave = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogClose />
        <DialogHeader>
          <DialogTitle>
            {endpoint ? 'Edit Provider' : 'Add Custom Provider'}
          </DialogTitle>
          <DialogDescription>
            Configure a custom API endpoint for LLM services.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="font-medium text-foreground text-xs">Name</p>
            <Input
              placeholder="My Azure OpenAI"
              value={name}
              onValueChange={setName}
              size="sm"
            />
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-foreground text-xs">API Spec</p>
            <Select
              value={apiSpec}
              onValueChange={(val) => setApiSpec(val as ApiSpec)}
              items={API_SPEC_OPTIONS}
              size="sm"
              triggerClassName="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-foreground text-xs">Base URL</p>
            <Input
              placeholder="https://your-endpoint.example.com/v1"
              value={baseUrl}
              onValueChange={setBaseUrl}
              size="sm"
            />
          </div>

          <div className="space-y-1.5">
            <p className="font-medium text-foreground text-xs">
              API Key{' '}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </p>
            <Input
              type="password"
              placeholder={
                endpoint?.encryptedApiKey
                  ? 'Leave blank to keep current key'
                  : 'Enter API key...'
              }
              value={apiKey}
              onValueChange={setApiKey}
              size="sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="primary"
            size="sm"
            disabled={!canSave}
            onClick={() => {
              onSave({ name: name.trim(), apiSpec, baseUrl, apiKey });
              onOpenChange(false);
            }}
          >
            {endpoint ? 'Save Changes' : 'Add Provider'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomEndpointCard({
  endpoint,
  onEdit,
  onDelete,
}: {
  endpoint: CustomEndpoint;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const specLabel =
    API_SPEC_OPTIONS.find((o) => o.value === endpoint.apiSpec)?.label ??
    endpoint.apiSpec;

  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-derived p-4">
      <div className="min-w-0 flex-1">
        <h3 className="font-medium text-foreground text-sm">{endpoint.name}</h3>
        <p className="truncate text-muted-foreground text-xs">
          {specLabel} &middot; {endpoint.baseUrl || 'No URL set'}
        </p>
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
  );
}

function CustomEndpointsSection() {
  const preferences = useKartonState((s) => s.preferences);
  const updatePreferences = useKartonProcedure((s) => s.updatePreferences);
  const setCustomEndpointApiKey = useKartonProcedure(
    (s) => s.setCustomEndpointApiKey,
  );

  const endpoints = preferences?.customEndpoints ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<
    CustomEndpoint | undefined
  >(undefined);

  const handleAdd = useCallback(() => {
    setEditingEndpoint(undefined);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((ep: CustomEndpoint) => {
    setEditingEndpoint(ep);
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(
    async (data: {
      name: string;
      apiSpec: ApiSpec;
      baseUrl: string;
      apiKey: string;
    }) => {
      if (editingEndpoint) {
        const idx = endpoints.findIndex((ep) => ep.id === editingEndpoint.id);
        if (idx === -1) return;
        const [, patches] = produceWithPatches(preferences, (draft) => {
          draft.customEndpoints[idx].name = data.name;
          draft.customEndpoints[idx].apiSpec = data.apiSpec;
          draft.customEndpoints[idx].baseUrl = data.baseUrl;
        });
        await updatePreferences(patches);

        if (data.apiKey) {
          await setCustomEndpointApiKey(editingEndpoint.id, data.apiKey);
        }
      } else {
        const id = crypto.randomUUID();
        const [, patches] = produceWithPatches(preferences, (draft) => {
          draft.customEndpoints.push({
            id,
            name: data.name,
            apiSpec: data.apiSpec,
            baseUrl: data.baseUrl,
          });
        });
        await updatePreferences(patches);

        if (data.apiKey) {
          await setCustomEndpointApiKey(id, data.apiKey);
        }
      }
    },
    [
      editingEndpoint,
      endpoints,
      preferences,
      updatePreferences,
      setCustomEndpointApiKey,
    ],
  );

  const customModels = preferences?.customModels ?? [];

  const handleDelete = useCallback(
    async (endpointId: string) => {
      // Warn if any custom models reference this endpoint
      const affectedModels = customModels.filter(
        (m) => m.endpointId === endpointId,
      );
      if (affectedModels.length > 0) {
        const names = affectedModels.map((m) => m.displayName).join(', ');
        const confirmed = window.confirm(
          `The following custom models use this provider and will stop working:\n\n${names}\n\nDelete anyway?`,
        );
        if (!confirmed) return;
      }

      const [, patches] = produceWithPatches(preferences, (draft) => {
        const idx = draft.customEndpoints.findIndex(
          (ep) => ep.id === endpointId,
        );
        if (idx !== -1) {
          draft.customEndpoints.splice(idx, 1);
        }
      });
      await updatePreferences(patches);
    },
    [preferences, updatePreferences, customModels],
  );

  return (
    <div className="space-y-3">
      {endpoints.length === 0 ? (
        <div className="rounded-lg border border-derived-subtle p-4">
          <p className="text-center text-muted-foreground text-sm">
            No custom providers configured yet.
          </p>
        </div>
      ) : (
        endpoints.map((ep) => (
          <CustomEndpointCard
            key={ep.id}
            endpoint={ep}
            onEdit={() => handleEdit(ep)}
            onDelete={() => handleDelete(ep.id)}
          />
        ))
      )}

      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={handleAdd}>
          <IconPlusOutline18 className="size-3.5" />
          Add Provider
        </Button>
      </div>

      <CustomEndpointDialog
        endpoint={editingEndpoint}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
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
      <div className="flex items-center border-derived-subtle border-b px-6 py-4">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate({ to: '/agent-settings/models-providers' })}
          >
            <IconChevronLeftOutline18 className="size-4" />
          </Button>
          <div className="flex flex-col">
            <h1 className="font-semibold text-foreground text-xl">
              Custom Providers
            </h1>
            <span className="text-muted-foreground text-sm">
              Add custom API endpoints for self-hosted or third-party LLM
              services.
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <OverlayScrollbar className="flex-1" contentClassName="p-6">
        <div className="mx-auto max-w-3xl">
          <CustomEndpointsSection />
        </div>
      </OverlayScrollbar>
    </div>
  );
}
