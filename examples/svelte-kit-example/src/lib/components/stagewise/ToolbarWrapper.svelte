<script lang="ts">
import type { ToolbarConfig } from '@stagewise/toolbar';
import { onMount } from 'svelte';
import { browser } from '$app/environment';

let isLoaded = false;
const stagewiseConfig: ToolbarConfig = {
  plugins: [],
};

onMount(async () => {
  if (isLoaded || !browser) return;
  isLoaded = true;

  const { initToolbar } = await import('@stagewise/toolbar');
  initToolbar(stagewiseConfig);
});
</script> 