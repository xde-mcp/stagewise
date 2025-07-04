import { resolve } from 'node:path';
import { build } from 'vite';
import { generateDeclarationFile } from './utils.js';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import fs from 'node:fs';

const mode = process.argv[2];

export default async function buildToolbarLoader() {
  // load the manifest.json from the toolbar-main build.
  const manifest = JSON.parse(
    fs.readFileSync(
      resolve(process.cwd(), 'tmp/toolbar-main/.vite/manifest.json'),
      'utf8',
    ),
  );

  const mainModules: Record<string, string> = {};
  for (const key of Object.keys(manifest)) {
    if (manifest[key].file.endsWith('.js')) {
      const lookupKey = manifest[key].file;
      mainModules[lookupKey] = fs.readFileSync(
        resolve(process.cwd(), 'tmp/toolbar-main', manifest[key].file),
        'utf8',
      );
    }
  }

  await build({
    mode: mode,
    define: {
      __MAIN_MODULES__: JSON.stringify(mainModules),
    },
    resolve: {
      alias: {
        '@': resolve(process.cwd(), 'src'),
        'tmp/toolbar-main': resolve(process.cwd(), 'tmp/toolbar-main'),
      },
      mainFields: ['module', 'main'],
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },
    esbuild: {
      minifyIdentifiers: false,
      treeShaking: mode === 'production',
    },
    build: {
      outDir: resolve(process.cwd(), 'tmp/toolbar-loader'),
      commonjsOptions: {
        transformMixedEsModules: true,
        requireReturnsDefault: 'auto',
      },
      lib: {
        entry: {
          index: resolve(process.cwd(), 'src/loader.ts'),
        },
        name: 'StagewiseToolbarLoader',
        fileName: (format, entryName) => `${entryName}.${format}.js`,
        formats: ['es', 'cjs'],
      },
      sourcemap: mode === 'development' ? 'inline' : false,
      rollupOptions: {
        external: ['index.js'],
        output: {
          manualChunks: undefined,
          preserveModules: false,
        },
        treeshake: mode === 'production',
      },
      minify: mode === 'production',
      cssMinify: mode === 'production',
    },
    optimizeDeps: {
      esbuildOptions: {
        mainFields: ['module', 'main'],
      },
    },
  });

  generateDeclarationFile(
    {
      [resolve(process.cwd(), 'src/loader.ts')]: 'index',
    },
    resolve(process.cwd(), 'tmp/toolbar-loader/unbundled-types'),
  );

  const extractorConfig = ExtractorConfig.loadFileAndPrepare(
    resolve(process.cwd(), 'api-extractor-configs/loader.json'),
  );

  Extractor.invoke(extractorConfig, {});
}
