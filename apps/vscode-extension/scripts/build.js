const { build } = require('esbuild');
const { mkdir } = require('node:fs/promises');
const { join } = require('node:path');

async function main() {
  try {
    // Ensure the output directory exists
    await mkdir(join(__dirname, '../out'), { recursive: true });

    console.log('Building VSCode extension...');

    // Build the extension with the same options as vscode:prepublish
    await build({
      entryPoints: [join(__dirname, '../src/extension.ts')],
      bundle: true,
      outfile: join(__dirname, '../out/extension.js'),
      external: ['vscode'], // VSCode API should be external
      platform: 'node',
      format: 'cjs',
      packages: 'bundle', // Bundle all packages except those marked as external
      sourcemap: true,
      logLevel: 'info',
    });

    console.log('Build completed successfully!');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

main();
