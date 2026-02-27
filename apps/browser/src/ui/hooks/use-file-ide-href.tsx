import { useCallback, useMemo } from 'react';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import { useMountedPaths } from '@ui/hooks/use-mounted-paths';
import type { Mount } from '@shared/karton-contracts/ui/agent/metadata';
import { useOpenAgent } from '@ui/hooks/use-open-chat';
import { useFileIDEHref as useFileIDEHrefBase } from '@shared/hooks/use-file-ide-href';

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

  const resolvePath = useCallback(
    (relativePath: string) => resolveAbsolutePath(relativePath, mounts),
    [mounts],
  );

  return useFileIDEHrefBase({
    resolvePath,
    globalConfig,
    setGlobalConfig,
  });
}
