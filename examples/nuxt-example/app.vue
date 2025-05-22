<script setup lang="ts">
import { StagewiseToolbar } from '@stagewise/toolbar-vue';
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <ClientOnly>
      <StagewiseToolbar />
    </ClientOnly>
    <NuxtWelcome />
  </div>
</template>
