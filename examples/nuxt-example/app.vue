<script setup lang="ts">
import { StagewiseToolbar, type ToolbarConfig } from '@stagewise/toolbar-vue';
import { VuePlugin } from '@stagewise-plugins/vue';

// biome-ignore lint/correctness/noUnusedVariables: Biome doesn't understand vue?
const toolbarConfig: ToolbarConfig = {
  plugins: [VuePlugin],
};
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <ClientOnly>
      <StagewiseToolbar :config="toolbarConfig" />
    </ClientOnly>
    <NuxtWelcome />
  </div>
</template>
