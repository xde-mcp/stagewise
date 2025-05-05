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