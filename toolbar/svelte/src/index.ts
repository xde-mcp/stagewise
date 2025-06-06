// Re-export types from dedicated types file
export type { ToolbarConfig } from './types.js';

// Import the custom element class
import StagewiseToolbarElement from './Toolbar.svelte';

// Register the custom element
if (typeof window !== 'undefined') {
  customElements.define('stagewise-toolbar', StagewiseToolbarElement);
}

// Export the element class
export { StagewiseToolbarElement as StagewiseToolbar };
