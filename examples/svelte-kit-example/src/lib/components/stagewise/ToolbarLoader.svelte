<script lang="ts">
import ToolbarWrapper from './ToolbarWrapper.svelte';
import { browser } from '$app/environment';
</script>

{#if browser}
  <ToolbarWrapper />
{/if} 