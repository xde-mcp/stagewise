<script lang="ts">
import type { ToolbarConfig } from '@stagewise/toolbar';
import ToolbarWrapper from './ToolbarWrapper.svelte';
import { browser } from '$app/environment';
</script>

{#if browser}
  <ToolbarWrapper />
{/if} 