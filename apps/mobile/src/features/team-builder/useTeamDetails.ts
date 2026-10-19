import {
  getEntityNames,
  getMoveSummaries,
  getPokemon,
  type GameContext,
  type MoveSummary,
  type PokemonDetail,
  type TeamMember,
} from '@thedex/db';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useAsync } from '../../shared/hooks/useAsync';

/** Game data of a team's slots, resolved for the team's game (RF08.2 / RF08.3). */
export interface TeamDetails {
  /** Varieties by id; a variety missing from the team's generation has `stats: null`. */
  readonly pokemon: ReadonlyMap<number, PokemonDetail>;
  readonly moves: ReadonlyMap<number, MoveSummary>;
  readonly items: ReadonlyMap<number, string>;
}

/** Loads what the team screens show for `members`; reloads when a slot's ids change. */
export function useTeamDetails(
  members: readonly TeamMember[],
  ctx: GameContext | null,
): TeamDetails | undefined {
  const { db } = useAppDatabase();
  const key = members
    .map((m) => [m.pokemonId, m.itemId ?? '', ...m.moveIds.map((id) => id ?? '')].join('.'))
    .join('|');
  const { data } = useAsync(async () => {
    if (!ctx) return undefined;
    const pokemon = new Map<number, PokemonDetail>();
    for (const id of new Set(members.map((m) => m.pokemonId))) {
      const detail = await getPokemon(db, id, ctx);
      if (detail) pokemon.set(id, detail);
    }
    const moveIds = members.flatMap((m) => m.moveIds.filter((id): id is number => id !== null));
    const itemIds = members.flatMap((m) => (m.itemId === null ? [] : [m.itemId]));
    return {
      pokemon,
      moves: await getMoveSummaries(db, ctx, moveIds),
      items: await getEntityNames(db, ctx.langChain, 'item', itemIds),
    };
    // `key` stands for the ids in `members`.
  }, [db, ctx, key]);
  return data;
}
