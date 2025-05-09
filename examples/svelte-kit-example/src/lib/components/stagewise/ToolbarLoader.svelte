<script lang="ts">
import type { ToolbarConfig } from '@stagewise/toolbar';
import ToolbarWrapper from './ToolbarWrapper.svelte';
import { browser } from '$app/environment';

const stagewiseConfig: ToolbarConfig = {
  plugins: [
    {
      name: 'svelte',
      description: 'Adds context for Svelte components',
      shortInfoForPrompt: () => {
        return "The selected component is a Svelte component. It's called 'blablub'. It's inside XY.";
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

{#if browser}
  <ToolbarWrapper config={stagewiseConfig} />
{/if} 