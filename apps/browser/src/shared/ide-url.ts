import type { OpenFilesInIde } from '@shared/karton-contracts/ui/shared-types';
import { getCurrentPlatform } from '@shared/hotkeys';

const nativeFileManagerLabel = (() => {
  const platform = getCurrentPlatform();
  if (platform === 'mac') return 'Finder';
  if (platform === 'windows') return 'Explorer';
  return 'File Manager';
})();

export const IDE_SELECTION_ITEMS: Record<OpenFilesInIde, string> = {
  vscode: 'VS Code',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  trae: 'Trae',
  zed: 'Zed',
  kiro: 'Kiro',
  other: nativeFileManagerLabel,
};

export const getIDEFileUrl = (
  absFilePath: string,
  ide: OpenFilesInIde,
  lineNumber?: number,
) => {
  let url: string;
  switch (ide) {
    case 'vscode':
      url = `vscode://file/${absFilePath}`;
      break;
    case 'cursor':
      url = `cursor://file/${absFilePath}`;
      break;
    case 'windsurf':
      url = `windsurf://file/${absFilePath}`;
      break;
    case 'trae':
      url = `trae://file/${absFilePath}`;
      break;
    case 'zed':
      url = `zed://file/${absFilePath}`;
      break;
    case 'kiro':
      url = `kiro://file/${absFilePath}`;
      break;
    case 'other':
      url = `stagewise://reveal-file/${absFilePath}`;
      break;
  }
  if (lineNumber) url += `:${lineNumber}`;

  return url;
};
