import { initToolbar } from '@stagewise/toolbar';

export function init() {
  if (import.meta.env.DEV) {
    initToolbar({
      plugins: [],
    });
  }
}
