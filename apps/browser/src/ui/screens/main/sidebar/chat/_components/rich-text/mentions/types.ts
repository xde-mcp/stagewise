import type { BaseNodeAttrs } from '../shared/types';
import type {
  FileMentionMeta,
  TabMentionMeta,
  MentionMeta,
} from '@shared/karton-contracts/ui/agent/metadata';

export interface MentionAttrs extends BaseNodeAttrs {
  providerType: 'file' | 'tab';
  meta: MentionMeta | null;
}

export interface MentionItemBase {
  id: string;
  label: string;
  description?: string;
  /** Controls which end of the description gets the ellipsis. Default: 'end'. */
  descriptionTruncation?: 'start' | 'end';
  keywords?: string[];
  /** Auto-injected from provider.groupLabel by queryAllProviders if not set. */
  group?: string;
  /** Override the string used for fuzzy scoring (defaults to description+label). */
  searchText?: string;
  /** 0-1 contextual importance set by the provider (recency, frequency, etc.). */
  relevance?: number;
}

export type FileMentionItem = MentionItemBase & {
  providerType: 'file';
  meta: FileMentionMeta;
};

export type TabMentionItem = MentionItemBase & {
  providerType: 'tab';
  meta: TabMentionMeta;
};

export type MentionItem = FileMentionItem | TabMentionItem;

/** MentionItem after queryAllProviders has injected group. */
export type ResolvedMentionItem = MentionItem & { group: string };
