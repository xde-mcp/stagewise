import { generateDeclarationFile } from './utils.js';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import { resolve } from 'node:path';

export default async function buildPluginUi() {
  generateDeclarationFile(
    {
      [resolve(process.cwd(), 'src/plugin-ui/index.tsx')]: 'index',
    },
    resolve(process.cwd(), 'tmp/plugin-ui/unbundled-types'),
  );

  const extractorConfig = ExtractorConfig.loadFileAndPrepare(
    resolve(process.cwd(), 'api-extractor-configs/plugin-ui.json'),
  );

  Extractor.invoke(extractorConfig, {});
}
