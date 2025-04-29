import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    preact({
      reactAliasesEnabled: true,
    }),
    tailwindcss(),
    dts({ rollupTypes: true }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    mainFields: ['module', 'main'],
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  esbuild: {
    minifyIdentifiers: false,
    treeShaking: true,
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/node_modules/, /\@stagewise\/extension-toolbar-srpc-contract/],
      requireReturnsDefault: 'auto',
    },
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'StagewiseToolbar',
      fileName: 'index',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      output: {
        manualChunks: undefined,
        preserveModules: false,
        globals: {
          preact: 'Preact',
        },
      },
      treeshake: true,
    },
    minify: false,
    cssMinify: false,
  },
  optimizeDeps: {
    include: ['@stagewise/extension-toolbar-srpc-contract'],
    esbuildOptions: {
      mainFields: ['module', 'main'],
    },
  },
});
