import preact from '@preact/preset-vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type PluginOption } from 'vite';
import dts from 'vite-plugin-dts';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    preact({
      reactAliasesEnabled: true,
    }),
    dts({ rollupTypes: true }) as PluginOption,
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
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'plugin-ui': resolve(__dirname, 'src/plugin-ui/index.tsx'),
        'plugin-ui/jsx-runtime': resolve(
          __dirname,
          'src/plugin-ui/jsx-runtime.ts',
        ),
        'mcp-server': resolve(__dirname, 'src/mcp-server.ts'),
      },
      name: 'StagewiseToolbar',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      output: [
        // ES modules for main library
        {
          format: 'es',
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'mcp-server') {
              return 'mcp-server.js';
            }
            return '[name].es.js';
          },
          // Add shebang to MCP server
          banner: (chunk) => {
            if (chunk.name === 'mcp-server') {
              return '#!/usr/bin/env node';
            }
            return '';
          },
        },
        // CommonJS for compatibility (exclude mcp-server)
        {
          format: 'cjs',
          entryFileNames: '[name].cjs.js',
          exports: 'named',
        },
      ],
      // External dependencies for MCP server
      external: (id) => {
        if (id.startsWith('@modelcontextprotocol/sdk')) {
          return true;
        }
        return false;
      },
      treeshake: true,
    },
    minify: false,
    cssMinify: false,
    cssCodeSplit: false,
  },
  optimizeDeps: {
    include: ['@stagewise/extension-toolbar-srpc-contract'],
    esbuildOptions: {
      mainFields: ['module', 'main'],
    },
  },
});
