import uFuzzy from '@leeoniya/ufuzzy';

const uf = new uFuzzy({
  intraMode: 1,
  intraSub: 1,
  intraTrn: 1,
  intraDel: 1,
  intraIns: 1,
});

/**
 * Batch-scores how well `query` matches each string in `haystack` using uFuzzy.
 * Returns a Map from haystack index to a 0-1 score (higher = better match).
 * Items not in the map did not match at all.
 */
export function batchFuzzyScore(
  query: string,
  haystack: string[],
): Map<number, number> {
  if (!query || haystack.length === 0) return new Map();

  const [idxs, info, order] = uf.search(haystack, query, 1);

  if (!idxs || !order || order.length === 0) return new Map();

  const scores = new Map<number, number>();
  const count = order.length;

  for (let rank = 0; rank < count; rank++) {
    const haystackIdx = info.idx[order[rank]];
    scores.set(haystackIdx, 1 - rank / Math.max(count, 2));
  }

  return scores;
}
