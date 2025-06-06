<script lang="ts">
import type { ToolbarConfig } from './types';

export let config: ToolbarConfig | undefined = undefined;
export let enabled: boolean = process.env.NODE_ENV === 'development';

const isBrowser = typeof window !== 'undefined';

async function init() {
  if (!enabled || !isBrowser) return;

  const { initToolbar } = await import('@stagewise/toolbar');
  initToolbar(config);
}

// Initialize when the element is connected to the DOM
if (isBrowser) {
  init();
}

// Export as custom element
export default class StagewiseToolbarElement extends HTMLElement {}
</script>

<slot />