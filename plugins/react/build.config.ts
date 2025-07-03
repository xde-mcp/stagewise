import buildPlugin from '@stagewise/plugin-builder';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

buildPlugin(__dirname);
