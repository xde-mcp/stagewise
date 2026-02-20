import { useCallback } from 'react';
import { useKartonState } from '@/hooks/use-karton';
import { useMessageAccessPath } from '@ui/hooks/use-message-access-path';
import { getIDEFileUrl } from '@ui/utils';

export function useFileIDEHref() {
  const messageAccessPath = useMessageAccessPath();
  const liveAccessPath = useKartonState((s) => s.workspace?.agent?.accessPath);
  const accessPath = messageAccessPath ?? liveAccessPath;
  const openInIdeChoice = useKartonState((s) => s.globalConfig.openFilesInIde);

  const getFileIDEHref = useCallback(
    (relativeFilePath: string, lineNumber?: number) => {
      if (!accessPath) return '#';
      return getIDEFileUrl(
        accessPath.replace('\\', '/') +
          '/' +
          relativeFilePath.replace('\\', '/'),
        openInIdeChoice,
        lineNumber,
      );
    },
    [accessPath, openInIdeChoice],
  );

  return {
    getFileIDEHref,
  };
}
