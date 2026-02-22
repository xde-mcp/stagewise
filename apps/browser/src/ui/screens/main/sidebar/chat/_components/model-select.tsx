import { Combobox as ComboboxBase } from '@base-ui/react/combobox';
import {
  Combobox,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
} from '@stagewise/stage-ui/components/combobox';
import type { ModelId } from '@shared/available-models';
import { IconBrainOutline18 } from 'nucleo-ui-outline-18';
import { IconChevronDownFill18 } from 'nucleo-ui-fill-18';
import { availableModels } from '@shared/available-models';
import { useKartonProcedure, useKartonState } from '@/hooks/use-karton';
import { useOpenAgent } from '@/hooks/use-open-chat';
import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/utils';

// ============================================================================
// Types
// ============================================================================

interface ModelOption {
  modelId: string;
  displayName: string;
  description: string;
  context: string;
  thinkingEnabled: boolean;
  group?: string;
}

// ============================================================================
// Sub-components
// ============================================================================

function ModelTooltipContent({
  model,
  description,
  context,
}: {
  model: string;
  description: string;
  context: string;
}): React.ReactNode {
  return (
    <div className="flex w-48 flex-col gap-1.5">
      <div className="font-semibold">{model}</div>
      <div className="text-muted-foreground">{description}</div>
      <div className="text-[10px] text-muted-foreground/70">{context}</div>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

interface ModelSelectProps {
  onModelChange?: () => void;
}

export const ModelSelect = memo(function ModelSelect({
  onModelChange,
}: ModelSelectProps) {
  const [openAgent] = useOpenAgent();
  const selectedModel = useKartonState((s) =>
    openAgent ? s.agents.instances[openAgent]?.state.activeModelId : null,
  );
  const setSelectedModel = useKartonProcedure((p) => p.agents.setActiveModelId);
  const customModels = useKartonState((s) => s.preferences?.customModels ?? []);

  // Build flat model options list
  const modelOptions = useMemo<ModelOption[]>(() => {
    const builtIn: ModelOption[] = availableModels.map((model) => ({
      modelId: model.modelId,
      displayName: model.modelDisplayName,
      description: model.modelDescription,
      context: model.modelContext,
      thinkingEnabled: 'thinkingEnabled' in model && !!model.thinkingEnabled,
    }));

    const custom: ModelOption[] = customModels.map((model) => ({
      modelId: model.modelId,
      displayName: model.displayName,
      description: model.description,
      context: `${Math.round(model.contextWindowSize / 1000)}k context`,
      thinkingEnabled: !!model.thinkingEnabled,
      group: 'Custom',
    }));

    return [...builtIn, ...custom];
  }, [customModels]);

  // Index by modelId for fast lookups
  const modelMap = useMemo(() => {
    const map = new Map<string, ModelOption>();
    for (const m of modelOptions) {
      map.set(m.modelId, m);
    }
    return map;
  }, [modelOptions]);

  // Group models for rendering (ungrouped built-in + custom group)
  const groupedModels = useMemo(() => {
    const groups: { label: string | null; models: ModelOption[] }[] = [];
    const ungrouped: ModelOption[] = [];
    const customGroup: ModelOption[] = [];

    for (const model of modelOptions) {
      if (model.group === 'Custom') {
        customGroup.push(model);
      } else {
        ungrouped.push(model);
      }
    }

    if (ungrouped.length > 0) groups.push({ label: null, models: ungrouped });
    if (customGroup.length > 0)
      groups.push({ label: 'Custom', models: customGroup });

    return groups;
  }, [modelOptions]);

  // Display label for the trigger
  const selectedDisplayName = useMemo(() => {
    if (!selectedModel) return 'Select model';
    return modelMap.get(selectedModel)?.displayName ?? selectedModel;
  }, [modelMap, selectedModel]);

  // Side-panel hover state
  const containerRef = useRef<HTMLDivElement>(null);
  const sidePanelRef = useRef<HTMLDivElement>(null);
  const [hoveredModel, setHoveredModel] = useState<ModelOption | null>(null);
  const [itemCenterY, setItemCenterY] = useState(0);
  const [sidePanelOffset, setSidePanelOffset] = useState(0);

  useLayoutEffect(() => {
    if (!hoveredModel || !sidePanelRef.current || !containerRef.current) return;
    const panelHeight = sidePanelRef.current.offsetHeight;
    const containerHeight = containerRef.current.offsetHeight;

    let offset = itemCenterY - panelHeight / 2;
    offset = Math.max(0, offset);
    offset = Math.min(offset, containerHeight - panelHeight);

    setSidePanelOffset(offset);
  }, [hoveredModel, itemCenterY]);

  const handleItemHover = useCallback(
    (model: ModelOption, event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const container = containerRef.current;
      if (!container) {
        setHoveredModel(model);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const itemRect = target.getBoundingClientRect();
      const centerY = itemRect.top + itemRect.height / 2 - containerRect.top;

      setItemCenterY(centerY);
      setHoveredModel(model);
    },
    [],
  );

  const handleValueChange = useCallback(
    (value: string | null) => {
      if (!openAgent || !value) return;
      setSelectedModel(openAgent, value as ModelId);
      onModelChange?.();
    },
    [openAgent, setSelectedModel, onModelChange],
  );

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) setHoveredModel(null);
  }, []);

  return (
    <Combobox
      value={selectedModel}
      onValueChange={handleValueChange}
      onOpenChange={handleOpenChange}
    >
      <ComboboxBase.Trigger
        className={cn(
          'inline-flex min-w-0 max-w-full cursor-pointer items-center justify-between gap-1 rounded-lg p-0 font-normal text-xs shadow-none transition-colors',
          'focus-visible:-outline-offset-2 focus-visible:outline-1 focus-visible:outline-muted-foreground/35',
          'has-disabled:pointer-events-none has-disabled:opacity-50',
          'bg-transparent text-muted-foreground hover:text-foreground data-popup-open:text-foreground',
          'h-4 w-auto',
        )}
      >
        <span className="truncate">{selectedDisplayName}</span>
        <ComboboxBase.Icon className="shrink-0">
          <IconChevronDownFill18 className="size-3" />
        </ComboboxBase.Icon>
      </ComboboxBase.Trigger>

      <ComboboxBase.Portal>
        <ComboboxBase.Backdrop className="fixed inset-0 z-50" />
        <ComboboxBase.Positioner
          side="top"
          sideOffset={4}
          align="start"
          className="z-50"
        >
          <div
            ref={containerRef}
            className="relative flex flex-row items-start gap-1"
            onMouseLeave={() => setHoveredModel(null)}
          >
            <ComboboxBase.Popup
              className={cn(
                'flex max-w-72 origin-(--transform-origin) flex-col items-stretch gap-0.5 text-xs',
                'rounded-lg border border-border-subtle bg-background p-1 shadow-lg',
                'transition-[transform,scale,opacity] duration-150 ease-out',
                'data-ending-style:scale-90 data-ending-style:opacity-0',
                'data-starting-style:scale-90 data-starting-style:opacity-0',
              )}
            >
              <div className="mb-1 rounded-md">
                <ComboboxInput size="xs" placeholder="Search…" />
              </div>

              <div className="scrollbar-subtle max-h-48 overflow-y-auto">
                <ComboboxList>
                  {groupedModels.map(({ label, models }) =>
                    label ? (
                      <ComboboxGroup key={label}>
                        <ComboboxGroupLabel>{label}</ComboboxGroupLabel>
                        {models.map((model) => (
                          <ModelItem
                            key={model.modelId}
                            model={model}
                            onHover={handleItemHover}
                          />
                        ))}
                      </ComboboxGroup>
                    ) : (
                      models.map((model) => (
                        <ModelItem
                          key={model.modelId}
                          model={model}
                          onHover={handleItemHover}
                        />
                      ))
                    ),
                  )}
                </ComboboxList>
              </div>

              <ComboboxEmpty />
            </ComboboxBase.Popup>

            {/* Animated side panel for model details */}
            {hoveredModel && (
              <div
                ref={sidePanelRef}
                className={cn(
                  'absolute left-full ml-1 flex max-w-64 flex-col gap-1 rounded-lg border border-derived bg-background p-2.5 text-foreground text-xs shadow-lg transition-[top] duration-100 ease-out',
                  'fade-in-0 slide-in-from-left-1 animate-in duration-150',
                )}
                style={{ top: sidePanelOffset }}
              >
                <ModelTooltipContent
                  model={hoveredModel.displayName}
                  description={hoveredModel.description}
                  context={hoveredModel.context}
                />
              </div>
            )}
          </div>
        </ComboboxBase.Positioner>
      </ComboboxBase.Portal>
    </Combobox>
  );
});

// ============================================================================
// ModelItem — extracted to keep list render clean
// ============================================================================

const ModelItem = memo(function ModelItem({
  model,
  onHover,
}: {
  model: ModelOption;
  onHover: (
    model: ModelOption,
    event: React.MouseEvent<HTMLDivElement>,
  ) => void;
}) {
  return (
    <ComboboxItem
      value={model.modelId}
      size="xs"
      onMouseEnter={(e) => onHover(model, e)}
    >
      <ComboboxItemIndicator />
      <span className="col-start-2 flex min-w-0 flex-row items-center justify-between gap-4 text-xs">
        <span className="truncate">{model.displayName}</span>
        {model.thinkingEnabled && (
          <div className="flex size-4 shrink-0 items-center justify-center">
            <IconBrainOutline18 className="size-3 text-muted-foreground" />
          </div>
        )}
      </span>
    </ComboboxItem>
  );
});
