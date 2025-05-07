# Stagewise Toolbar Nuxt Example

This example demonstrates how to integrate the Stagewise toolbar into a Nuxt project.

## Installation

1. Install the Stagewise toolbar package:
```bash
npm install @stagewise/core
# or
yarn add @stagewise/core
# or
pnpm add @stagewise/core
```

## Integration Steps

1. Create a toolbar wrapper component (`components/stagewise/ToolbarWrapper.vue`):
```ts
<script setup lang="ts">
import type { ToolbarConfig } from '@stagewise/core';
import { initToolbar } from '@stagewise/core';
import { onMounted, ref } from 'vue';

const props = defineProps<{
  config: ToolbarConfig;
}>();

const isLoaded = ref(false);

onMounted(() => {
  if (isLoaded.value) return;
  isLoaded.value = true;
  initToolbar(props.config);
});
</script>

<template>
  <div></div>
</template>
```

2. Create a toolbar loader component (`components/stagewise/ToolbarLoader.vue`):
```ts
<script setup lang="ts">
import type { ToolbarConfig } from '@stagewise/core';
import ToolbarWrapper from './ToolbarWrapper.vue';

const stagewiseConfig: ToolbarConfig = {
  plugins: [
    {
      name: 'vue',
      description: 'Adds context for Vue components',
      shortInfoForPrompt: () => {
        return "The selected component is a Vue component. It's called 'blablub'. It's inside XY.";
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

<template>
  <ClientOnly>
    <ToolbarWrapper :config="stagewiseConfig" />
  </ClientOnly>
</template>
```

3. Add the toolbar to your app (`app.vue`):
```ts
<template>
  <div>
    <NuxtRouteAnnouncer />
    <StagewiseToolbar />
    <NuxtWelcome />
  </div>
</template>

<script setup>
import StagewiseToolbar from './components/stagewise/ToolbarLoader.vue';
</script>
```

## Important Notes

- The toolbar is client-side only and won't work during SSR
- We use Nuxt's `ClientOnly` component to ensure the toolbar only renders in the browser
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
