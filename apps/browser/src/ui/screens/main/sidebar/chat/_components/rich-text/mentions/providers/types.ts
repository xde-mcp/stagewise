import type { MentionItem } from '../types';

export interface MentionProviderIcon {
  id: string;
  className?: string;
}

export interface MentionProvider {
  type: string;
  groupLabel: string;
  /** Global importance multiplier (e.g. 1.3 for files, 1.0 for tabs). */
  boost: number;
  icon: React.ComponentType<MentionProviderIcon>;
  query: (input: string) => MentionItem[] | Promise<MentionItem[]>;
}
