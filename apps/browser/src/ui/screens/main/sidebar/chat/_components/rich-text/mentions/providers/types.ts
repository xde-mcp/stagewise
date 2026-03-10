import type { MentionItem } from '../types';
import type { MentionFileCandidate } from '@shared/karton-contracts/ui/agent/metadata';
import type { TabState, MountEntry } from '@shared/karton-contracts/ui';

export interface MentionProviderIcon {
  id: string;
  className?: string;
}

export interface MentionContext {
  agentInstanceId: string | null;
  searchFiles:
    | ((agentId: string, query: string) => Promise<MentionFileCandidate[]>)
    | null;
  tabs: Record<string, TabState>;
  activeTabId: string | null;
  mounts: MountEntry[];
}

export interface MentionProvider {
  type: 'file' | 'tab' | 'workspace';
  groupLabel: string;
  /** Global importance multiplier (e.g. 1.3 for files, 1.0 for tabs). */
  boost: number;
  icon: React.ComponentType<MentionProviderIcon>;
  query: (
    input: string,
    ctx: MentionContext,
  ) => MentionItem[] | Promise<MentionItem[]>;
}
