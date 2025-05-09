# Stagewise Toolbar SvelteKit Example

This example demonstrates how to integrate the Stagewise toolbar into a SvelteKit project.

## Installation

1. Install the Stagewise toolbar package:
```bash
npm install @stagewise/toolbar
# or
yarn add @stagewise/toolbar
# or
pnpm add @stagewise/toolbar
```

## Integration Steps

1. Create a toolbar wrapper component (`src/lib/components/stagewise/ToolbarWrapper.svelte`):
```ts
<script lang="ts">
import type { ToolbarConfig } from '@stagewise/toolbar';
import { onMount } from 'svelte';
import { browser } from '$app/environment';

export let config: ToolbarConfig;
let isLoaded = false;

onMount(async () => {
  if (isLoaded || !browser) return;
  isLoaded = true;
  
  const { initToolbar } = await import('@stagewise/toolbar');
  initToolbar(config);
});
</script>
```

2. Create a toolbar loader component (`src/lib/components/stagewise/ToolbarLoader.svelte`):
```ts
<script lang="ts">
import type { ToolbarConfig } from '@stagewise/toolbar';
import ToolbarWrapper from './ToolbarWrapper.svelte';
import { browser } from '$app/environment';

const stagewiseConfig: ToolbarConfig = {
  plugins: [
    {
      name: 'svelte',
      description: 'Adds context for Svelte components',
      shortInfoForPrompt: () => {
        return "The selected component is a Svelte component. It's called 'blablub'. It's inside XY.";
      },
      mcp: null,
      actions: [
        {
          name: 'Show alert',
          description:
            "Shows an alert with the message 'Ich bin eine custom action!'",
          execute: () => {
            window.alert('Ich bin eine custom action!');
          },
        },
      ],
    },
  ],
};
</script>

{#if browser}
  <ToolbarWrapper config={stagewiseConfig} />
{/if}
```

3. Add the toolbar to your layout or page (`src/routes/+page.svelte`):
```ts
<script lang="ts">
import StagewiseToolbar from '$lib/components/stagewise/ToolbarLoader.svelte';
</script>

<StagewiseToolbar />

<main>
  <!-- Your page content -->
</main>
```

## Important Notes

- The toolbar is client-side only and won't work during SSR
- We use dynamic imports to ensure the toolbar module is only loaded in the browser
- The `browser` check from `$app/environment` is used to prevent SSR issues
- Customize the `stagewiseConfig` object to add your own plugins and actions

## Development

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

## Building for Production

```bash
npm run build
# or
yarn build
# or
pnpm build
```
