import { useMemo } from 'react';
import {
  IconFolder5Outline18,
  IconCodeBranchOutline18,
} from 'nucleo-ui-outline-18';
import { cn } from '@/utils';
import { InlineBadge, InlineBadgeWrapper } from '../shared';
import { useMountedPaths } from '@ui/hooks/use-mounted-paths';
import { useKartonState } from '@/hooks/use-karton';
import { useOpenAgent } from '@/hooks/use-open-chat';
import { getBaseName } from '@shared/path-utils';
import type { WorkspaceMentionMeta } from '@shared/karton-contracts/ui/agent/metadata';

interface WorkspaceMentionBadgeProps {
  /** Mount prefix (e.g. "w1"). Used as the primary lookup key. */
  prefix: string;
  /** Direct meta from @-mention node attrs (fallback when live/snapshot data unavailable) */
  meta?: WorkspaceMentionMeta | null;
  selected?: boolean;
  isEditable?: boolean;
  onDelete?: () => void;
  viewOnly?: boolean;
}

export function WorkspaceMentionBadge({
  prefix,
  meta,
  selected = false,
  isEditable = false,
  onDelete,
  viewOnly = true,
}: WorkspaceMentionBadgeProps) {
  const historicalMounts = useMountedPaths();
  const [openAgentId] = useOpenAgent();

  const liveMount = useKartonState((s) => {
    if (!openAgentId) return null;
    const mounts = s.toolbox[openAgentId]?.workspace?.mounts;
    if (!mounts) return null;
    return mounts.find((m) => m.prefix === prefix) ?? null;
  });

  // Resolution priority: live mounts > historical snapshots > inline meta
  const wsData = useMemo(() => {
    if (liveMount) {
      return {
        name: getBaseName(liveMount.path) || liveMount.path,
        path: liveMount.path,
        isGitRepo: liveMount.isGitRepo,
        isMounted: true,
      };
    }

    if (historicalMounts) {
      const snapshot = historicalMounts.find((m) => m.prefix === prefix);
      if (snapshot) {
        return {
          name: getBaseName(snapshot.path) || snapshot.path,
          path: snapshot.path,
          isGitRepo: false,
          isMounted: false,
        };
      }
    }

    if (meta) {
      return {
        name: meta.name,
        path: meta.path,
        isGitRepo: false,
        isMounted: false,
      };
    }

    return null;
  }, [liveMount, historicalMounts, prefix, meta]);

  const displayLabel = useMemo(() => {
    if (!wsData) return prefix;
    const { name } = wsData;
    if (name.length > 24) return `${name.slice(0, 24)}...`;
    return name;
  }, [wsData, prefix]);

  const tooltipContent = useMemo(() => {
    if (!wsData) return prefix;
    return wsData.path;
  }, [wsData, prefix]);

  const icon = wsData?.isGitRepo ? (
    <IconCodeBranchOutline18 className="size-3 shrink-0" />
  ) : (
    <IconFolder5Outline18 className="size-3 shrink-0" />
  );

  return (
    <InlineBadgeWrapper viewOnly={viewOnly} tooltipContent={tooltipContent}>
      <InlineBadge
        icon={icon}
        label={displayLabel}
        selected={selected}
        isEditable={isEditable}
        onDelete={() => onDelete?.()}
        className={cn(!wsData?.isMounted && 'opacity-70')}
      />
    </InlineBadgeWrapper>
  );
}
