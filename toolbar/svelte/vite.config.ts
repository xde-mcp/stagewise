import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type PluginOption } from 'vite';
import dts from 'vite-plugin-dts';
import preserveDirectives from 'rollup-preserve-directives';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { visualizer } from 'rollup-plugin-visualizer';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    dts({
      rollupTypes: true,
    }) as PluginOption,
    preserveDirectives(),
    svelte({
      compilerOptions: {
        customElement: true,
        runes: false,
        dev: false,
        css: 'external',
      },
    }),
    mode === 'analyze' &&
      visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    mainFields: ['module', 'main'],
    extensions: ['.mjs', '.js', '.ts', '.json', '.svelte'],
  },
  esbuild: {
    minifyIdentifiers: false,
    treeShaking: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'StagewiseToolbarSvelte',
      fileName: 'index',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: [
        'svelte',
        'svelte/internal',
        'svelte/store',
        'svelte/transition',
        'svelte/animate',
        'svelte/easing',
        'svelte/motion',
        'svelte/ssr',
        '@stagewise/toolbar',
      ],
      output: {
        globals: {
          svelte: 'Svelte',
          'svelte/internal': 'SvelteInternal',
          'svelte/store': 'SvelteStore',
          'svelte/transition': 'SvelteTransition',
          'svelte/animate': 'SvelteAnimate',
          'svelte/easing': 'SvelteEasing',
          'svelte/motion': 'SvelteMotion',
          'svelte/ssr': 'SvelteSSR',
          '@stagewise/toolbar': '@stagewise/toolbar',
        },
      },
    },
    minify: true,
    cssMinify: true,
  },
  optimizeDeps: {
    esbuildOptions: {
      mainFields: ['module', 'main'],
    },
  },
}));
