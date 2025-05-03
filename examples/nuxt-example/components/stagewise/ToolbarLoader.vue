<script setup lang="ts">
import type { ToolbarConfig } from '@stagewise/toolbar';
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