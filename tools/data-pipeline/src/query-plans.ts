import type Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import {
  getLearnset,
  getPokemon,
  listGamePokemon,
  resolveGameContext,
  searchQuery,
  type GameContext,
} from '@thedex/db';

/** Tables large enough that a full scan would break the <100 ms budget on a phone. */
export const LARGE_TABLES: ReadonlySet<string> = new Set([
  'pokemon_moves',
  'encounters',
  'encounter_condition_value_map',
  'search_terms',
  'flavor_texts',
  'species_flavor_text',
  'move_flavor_text',
  'item_flavor_text',
  'ability_flavor_text',
  'pokemon_stats_by_gen',
  'pokemon_types_by_gen',
  'pokemon_abilities_by_gen',
  'move_stats_by_vg',
  'game_pokemon',
  'species_i18n',
  'move_i18n',
  'item_i18n',
  'form_i18n',
]);

/** Table aliases used by the @thedex/db repositories. */
const ALIASES: Readonly<Record<string, string>> = {
  t: 'search_terms',
  gp: 'game_pokemon',
  s: 'pokemon_stats_by_gen',
  pt: 'pokemon_types_by_gen',
  pa: 'pokemon_abilities_by_gen',
  pm: 'pokemon_moves',
  si: 'species_i18n',
  fi: 'form_i18n',
};

export interface PlanViolation {
  readonly label: string;
  readonly sql: string;
  readonly detail: string;
}

interface CapturedQuery {
  readonly label: string;
  readonly sql: string;
  readonly params: unknown[];
}

/** `SCAN <large table>` lines (virtual-table scans and CTE scans are fine). */
export function scanViolations(planDetails: readonly string[]): string[] {
  return planDetails.filter((detail) => {
    const match = /^SCAN (\S+)/.exec(detail);
    if (!match || detail.includes('VIRTUAL TABLE')) return false;
    const name = match[1]!;
    return LARGE_TABLES.has(ALIASES[name] ?? name);
  });
}

/**
 * Runs the hot repository queries (search, list, detail, learnset) through a logging Drizzle
 * instance and checks every captured statement with EXPLAIN QUERY PLAN.
 */
export async function checkHotQueryPlans(
  sqlite: Database.Database,
  sample: { game: string; pokemonId: number },
): Promise<{ checked: number; violations: PlanViolation[] }> {
  const captured: CapturedQuery[] = [];
  let label = '';
  const db = drizzle(sqlite, {
    logger: { logQuery: (sql, params) => captured.push({ label, sql, params }) },
  });

  const run = async <T>(name: string, fn: () => Promise<T>) => {
    label = name;
    return fn();
  };

  const ctx: GameContext = await run('resolveGameContext', () =>
    resolveGameContext(db, sample.game, ['pt-BR', 'en']),
  );
  await run('search ≥3 chars', () => searchQuery(db, 'char', ctx));
  await run('search <3 chars', () => searchQuery(db, 'pi', ctx));
  await run('search CJK <3 chars', () =>
    searchQuery(db, 'ピカ', { langChain: ['ja-Hrkt', 'ja', 'en'] }),
  );
  await run('listGamePokemon', () => listGamePokemon(db, ctx, { limit: 50, offset: 0 }));
  await run('getPokemon', () => getPokemon(db, sample.pokemonId, ctx));
  await run('getLearnset', () => getLearnset(db, sample.pokemonId, ctx));
  captured.push({
    label: 'move learners (RF03.3)',
    sql: 'SELECT DISTINCT pokemon_id, method_id FROM pokemon_moves WHERE move_id = ? AND version_group_id IN (?, ?, ?)',
    params: [85, ...ctx.versionGroupIds.concat(ctx.versionGroupIds).slice(0, 3)],
  });
  captured.push({
    label: 'sort by attack (RF01.4)',
    sql: 'SELECT pokemon_id FROM pokemon_stats_by_gen WHERE generation_id = ? ORDER BY attack DESC LIMIT 50',
    params: [ctx.generationId],
  });

  const violations: PlanViolation[] = [];
  for (const query of captured) {
    const plan = sqlite
      .prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
      .all(...(query.params as never[])) as { detail: string }[];
    for (const detail of scanViolations(plan.map((row) => row.detail))) {
      violations.push({ label: query.label, sql: query.sql, detail });
    }
  }
  return { checked: captured.length, violations };
}
