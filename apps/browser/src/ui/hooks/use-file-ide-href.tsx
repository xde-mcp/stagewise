import { useCallback } from 'react';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import { useMessageAccessPath } from '@ui/hooks/use-message-access-path';
import { getIDEFileUrl } from '@ui/utils';
import type { OpenFilesInIde } from '@shared/karton-contracts/ui/shared-types';

export function useFileIDEHref() {
  const messageAccessPath = useMessageAccessPath();
  const liveAccessPath = useKartonState((s) => s.workspace?.agent?.accessPath);
  const accessPath = messageAccessPath ?? liveAccessPath;
  const globalConfig = useKartonState((s) => s.globalConfig);
  const setGlobalConfig = useKartonProcedure((s) => s.config.set);

  const needsIdePicker = !globalConfig.hasSetIde;

  const getFileIDEHref = useCallback(
    (relativeFilePath: string, lineNumber?: number) => {
      if (!accessPath) return '#';
      return getIDEFileUrl(
        accessPath.replace('\\', '/') +
          '/' +
          relativeFilePath.replace('\\', '/'),
        globalConfig.openFilesInIde,
        lineNumber,
      );
    },
    [accessPath, globalConfig.openFilesInIde],
  );

  const pickIdeAndOpen = useCallback(
    async (
      ide: OpenFilesInIde,
      relativeFilePath: string,
      lineNumber?: number,
    ) => {
      await setGlobalConfig({
        ...globalConfig,
        openFilesInIde: ide,
        hasSetIde: true,
      });

      if (!accessPath) return;
      const url = getIDEFileUrl(
        accessPath.replace('\\', '/') +
          '/' +
          relativeFilePath.replace('\\', '/'),
        ide,
        lineNumber,
      );
      window.open(url, '_blank');
    },
    [globalConfig, setGlobalConfig, accessPath],
  );

  return {
    getFileIDEHref,
    needsIdePicker,
    pickIdeAndOpen,
  };
}
