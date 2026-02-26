import type { BaseNodeAttrs } from '../shared/types';

export interface MentionAttrs extends BaseNodeAttrs {
  providerType: string;
}

export interface MentionItem {
  id: string;
  label: string;
  /** Auto-injected from provider.type by queryAllProviders if not set. */
  providerType?: string;
  description?: string;
  keywords?: string[];
  /** Auto-injected from provider.groupLabel by queryAllProviders if not set. */
  group?: string;
  /** 0-1 contextual importance set by the provider (recency, frequency, etc.). */
  relevance?: number;
}

/** MentionItem after queryAllProviders has injected providerType and group. */
export type ResolvedMentionItem = MentionItem &
  Required<Pick<MentionItem, 'providerType' | 'group'>>;
