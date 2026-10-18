import { searchQuery, type SearchEntityType } from '@thedex/db';
import { useAppDatabase } from '../db/DatabaseProvider';
import { useGame } from '../game/GameProvider';
import { useAsync } from './useAsync';

/** Lists are capped by their own filters; the search only has to cover them. */
const SEARCH_LIMIT = 5000;

/**
 * Ids of one entity type matching `query` in the game-data languages (RNF07), to intersect
 * with a filtered list (`applySearch`). Null when the query is empty or still loading.
 */
export function useEntitySearch(
  entityType: SearchEntityType,
  query: string,
): ReadonlySet<number> | null {
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const text = query.trim();
  const { data } = useAsync(async () => {
    if (text === '') return null;
    const result = await searchQuery(db, text, ctx, {
      entityTypes: [entityType],
      limitPerType: SEARCH_LIMIT,
    });
    return new Set(result.hits.map((hit) => hit.entityId));
  }, [db, ctx, entityType, text]);
  return text === '' ? null : (data ?? null);
}
