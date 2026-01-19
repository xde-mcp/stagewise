import { createFileRoute } from '@tanstack/react-router';
import { SearchableSelect } from '@stagewise/stage-ui/components/searchable-select';
import { OverlayScrollbar } from '@stagewise/stage-ui/components/overlay-scrollbar';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import { IdeLogo } from '@ui/components/ide-logo';
import type { OpenFilesInIde } from '@shared/karton-contracts/ui/shared-types';

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
    label: (
      <div className="flex items-center gap-2">
        <IdeLogo ide={option.value} className="size-4" />
        <span>{option.label}</span>
      </div>
    ),
    triggerLabel: (
      <div className="flex items-center gap-2">
        <IdeLogo ide={option.value} className="size-4" />
        <span>{option.label}</span>
      </div>
    ),
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
        size="sm"
        triggerClassName="w-48 px-2 py-4"
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
        </div>
      </OverlayScrollbar>
    </div>
  );
}
