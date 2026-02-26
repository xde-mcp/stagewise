import type { MentionItem } from '../types';
import type { ResolvedMentionItem } from '../types';
import type { MentionProvider, MentionProviderIcon } from './types';
import { batchFuzzyScore } from './fuzzy-score';
import { stubFileProvider, stubTabProvider } from './stub';

const FUZZY_WEIGHT = 10;
const RELEVANCE_WEIGHT = 5;

const providerMap = new Map<string, MentionProvider>([
  [stubFileProvider.type, stubFileProvider],
  [stubTabProvider.type, stubTabProvider],
]);

type ScoredItem = ResolvedMentionItem & { _score: number };

export async function queryAllProviders(
  query: string,
): Promise<ResolvedMentionItem[]> {
  const results = await Promise.all(
    Array.from(providerMap.values()).map(async (p) => {
      const items = await p.query(query);
      return { provider: p, items };
    }),
  );

  const allEntries: Array<{ provider: MentionProvider; item: MentionItem }> =
    [];
  for (const { provider, items } of results) {
    for (const item of items) {
      allEntries.push({ provider, item });
    }
  }

  const haystack = allEntries.map(
    ({ item }) => `${item.label} ${item.description ?? ''}`,
  );
  const fuzzyScores = query
    ? batchFuzzyScore(query, haystack)
    : new Map<number, number>();

  const scored: ScoredItem[] = [];

  for (let i = 0; i < allEntries.length; i++) {
    const { provider, item } = allEntries[i];
    const fuzzy = fuzzyScores.get(i) ?? 0;
    const relevance = item.relevance ?? 0;
    const score =
      (fuzzy * FUZZY_WEIGHT + relevance * RELEVANCE_WEIGHT) * provider.boost;

    if (!query && relevance <= 0) continue;
    if (query && fuzzy <= 0) continue;

    scored.push({
      ...item,
      group: item.group ?? provider.groupLabel,
      providerType: item.providerType ?? provider.type,
      _score: score,
    });
  }

  scored.sort((a, b) => b._score - a._score);

  return scored.map(({ _score: _, ...item }) => item);
}

export function getProviderIcon(
  type: string,
): React.ComponentType<MentionProviderIcon> | undefined {
  return providerMap.get(type)?.icon;
}

export type { MentionProvider, MentionProviderIcon } from './types';
