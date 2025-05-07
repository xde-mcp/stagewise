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