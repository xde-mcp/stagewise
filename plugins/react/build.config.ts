import buildPlugin from '@stagewise/plugin-builder';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

await buildPlugin(dir);
