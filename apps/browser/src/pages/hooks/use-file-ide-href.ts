import { useCallback } from 'react';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import { stripMountPrefix } from '@ui/utils';
import type { WorkspaceMountInfo } from '@shared/karton-contracts/pages-api';
import { useFileIDEHref as useFileIDEHrefBase } from '@shared/hooks/use-file-ide-href';

function resolveAbsolutePath(
  mountPrefixedPath: string,
  workspaceMounts: WorkspaceMountInfo[],
): string | null {
  if (workspaceMounts.length === 0) return null;
  const relativePath = stripMountPrefix(mountPrefixedPath);
  if (!relativePath) return null;
  const normalized = relativePath.replace('\\', '/');
  if (normalized.startsWith('/')) return normalized;
  const basePath = workspaceMounts[0].path.replace('\\', '/');
  return `${basePath}/${normalized}`;
}

export function useFileIDEHref() {
  const workspaceMounts = useKartonState((s) => s.workspaceMounts);
  const globalConfig = useKartonState((s) => s.globalConfig);
  const setGlobalConfig = useKartonProcedure((s) => s.setGlobalConfig);

  const resolvePath = useCallback(
    (relativePath: string) =>
      resolveAbsolutePath(relativePath, workspaceMounts),
    [workspaceMounts],
  );

  return useFileIDEHrefBase({
    resolvePath,
    globalConfig,
    setGlobalConfig,
  });
}
