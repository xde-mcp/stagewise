import { useCallback, useMemo } from 'react';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import { useMountedPaths } from '@ui/hooks/use-mounted-paths';
import { getIDEFileUrl } from '@ui/utils';
import type { OpenFilesInIde } from '@shared/karton-contracts/ui/shared-types';
import type { Mount } from '@shared/karton-contracts/ui/agent/metadata';
import { useOpenAgent } from '@ui/hooks/use-open-chat';

function resolveAbsolutePath(
  relativeFilePath: string,
  mounts: Mount[],
): string | null {
  for (const mount of mounts) {
    if (relativeFilePath.startsWith(`${mount.prefix}/`)) {
      const stripped = relativeFilePath.slice(mount.prefix.length + 1);
      return `${mount.path.replace('\\', '/')}/${stripped.replace('\\', '/')}`;
    }
  }
  if (mounts.length === 1) {
    return `${mounts[0].path.replace('\\', '/')}/${relativeFilePath.replace('\\', '/')}`;
  }
  return null;
}

export function useFileIDEHref() {
  const historicalMounts = useMountedPaths();
  const [openAgentId] = useOpenAgent();
  const liveMounts = useKartonState((s) =>
    openAgentId ? (s.toolbox[openAgentId]?.workspace?.mounts ?? null) : null,
  );
  const mounts = useMemo(
    () => historicalMounts ?? liveMounts ?? [],
    [historicalMounts, liveMounts],
  );
  const globalConfig = useKartonState((s) => s.globalConfig);
  const setGlobalConfig = useKartonProcedure((s) => s.config.set);

  const needsIdePicker = !globalConfig.hasSetIde;

  const getFileIDEHref = useCallback(
    (relativeFilePath: string, lineNumber?: number) => {
      const absolutePath = resolveAbsolutePath(relativeFilePath, mounts);
      if (!absolutePath) return '#';
      return getIDEFileUrl(
        absolutePath,
        globalConfig.openFilesInIde,
        lineNumber,
      );
    },
    [mounts, globalConfig.openFilesInIde],
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

      const absolutePath = resolveAbsolutePath(relativeFilePath, mounts);
      if (!absolutePath) return;
      const url = getIDEFileUrl(absolutePath, ide, lineNumber);
      window.open(url, '_blank');
    },
    [globalConfig, setGlobalConfig, mounts],
  );

  return {
    getFileIDEHref,
    needsIdePicker,
    pickIdeAndOpen,
  };
}
