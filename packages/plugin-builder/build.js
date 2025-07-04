#!/usr/bin/env node
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isWatch = process.argv.includes('--watch');

// Ensure dist directory exists
if (!existsSync('dist')) {
  mkdirSync('dist');
}

// Build JS with esbuild
const buildConfig = {
  entryPoints: [resolve(__dirname, 'src/index.ts')],
  bundle: true,
  outfile: resolve(__dirname, 'dist/index.es.js'),
  format: 'esm',
  platform: 'node',
  target: 'node18',
  external: [
    'vite',
    '@vitejs/plugin-react-swc',
    'vite-plugin-dts',
    'rollup-preserve-directives',
    'node:*',
    'typescript',
  ],
  minify: false,
  sourcemap: false,
};

if (isWatch) {
  console.log('👀 Watching for changes...');
  const ctx = await build({ ...buildConfig, watch: true });

  process.on('SIGINT', async () => {
    await ctx.dispose();
    process.exit(0);
  });
} else {
  await build(buildConfig);
  console.log('✅ Built dist/index.es.js');
}

// Generate TypeScript declarations
try {
  execSync(
    `tsc src/index.ts --declaration --emitDeclarationOnly --outDir dist --skipLibCheck --noImplicitAny false --strict false`,
    {
      stdio: 'pipe', // Suppress TypeScript warnings
      cwd: __dirname,
    },
  );
} catch (_error) {
  // TypeScript may throw errors but still generate files, so check if files exist
}

// Check if declaration file was generated
if (existsSync(resolve(__dirname, 'dist/index.d.ts'))) {
  console.log('✅ Generated dist/index.d.ts');
  console.log('🎉 Build completed successfully!');
} else {
  console.error('❌ Failed to generate TypeScript declarations');
  if (!isWatch) {
    process.exit(1);
  }
}
