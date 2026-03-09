import { useCallback } from 'react';
import { getIDEFileUrl } from '@shared/ide-url';
import type {
  OpenFilesInIde,
  GlobalConfig,
} from '@shared/karton-contracts/ui/shared-types';

export type UseFileIDEHrefOptions = {
  resolvePath: (relativePath: string) => string | null;
  globalConfig: GlobalConfig;
  setGlobalConfig: (config: GlobalConfig) => Promise<void>;
};

export function useFileIDEHref({
  resolvePath,
  globalConfig,
  setGlobalConfig,
}: UseFileIDEHrefOptions) {
  const needsIdePicker = !globalConfig.hasSetIde;

  const getFileIDEHref = useCallback(
    (relativePath: string, lineNumber?: number) => {
      const absolutePath = resolvePath(relativePath);
      if (!absolutePath) return '#';
      return getIDEFileUrl(
        absolutePath,
        globalConfig.openFilesInIde,
        lineNumber,
      );
    },
    [resolvePath, globalConfig.openFilesInIde],
  );

  const pickIdeAndOpen = useCallback(
    async (ide: OpenFilesInIde, relativePath: string, lineNumber?: number) => {
      await setGlobalConfig({
        ...globalConfig,
        openFilesInIde: ide,
        hasSetIde: true,
      });

      const absolutePath = resolvePath(relativePath);
      if (!absolutePath) return;
      const url = getIDEFileUrl(absolutePath, ide, lineNumber);
      window.open(url, '_blank');
    },
    [globalConfig, setGlobalConfig, resolvePath],
  );

  return {
    getFileIDEHref,
    needsIdePicker,
    pickIdeAndOpen,
    resolvePath,
  };
}
