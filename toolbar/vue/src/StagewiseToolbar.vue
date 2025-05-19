<script setup lang="ts">
import { initToolbar, type ToolbarConfig } from '@stagewise/toolbar';
import { onMounted, watch } from 'vue';

// Define props
const props = defineProps<{
  config?: ToolbarConfig;
}>();

onMounted(() => {
  if (process.env.NODE_ENV === 'development') {
    initToolbar(props.config);
  }
});

// If the config can change dynamically and the toolbar needs to re-initialize
watch(
  () => props.config,
  (newConfig) => {
    if (process.env.NODE_ENV === 'development') {
      // We might need a way to destroy/re-initialize the toolbar if initToolbar isn't idempotent
      // or doesn't handle being called multiple times.
      // For now, just calling it again.
      console.log('StagewiseToolbar: Config changed, re-initializing.');
      initToolbar(newConfig);
    }
  },
  { deep: true },
);

// This component does not render any DOM elements itself
</script>

<template>
  <!-- This component is a functional component and does not render HTML -->
</template>
