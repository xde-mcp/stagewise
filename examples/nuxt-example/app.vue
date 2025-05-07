<script setup lang="ts">
import { StagewiseToolbar, type ToolbarConfig } from '@stagewise/vue';

const config: ToolbarConfig = {
  plugins: [],
};
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <ClientOnly>
      <StagewiseToolbar :config="config" />
    </ClientOnly>
    <NuxtWelcome />
  </div>
</template>
