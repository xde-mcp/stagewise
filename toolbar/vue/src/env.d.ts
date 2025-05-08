/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  import type { ToolbarConfig } from '@stagewise/core';
  const component: DefineComponent<
    { config: ToolbarConfig },
    Record<string, never>,
    any
  >;
  export default component;
}
