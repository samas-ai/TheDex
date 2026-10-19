import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import {
  getAbilityDetail,
  getAbilityHolders,
  getChecklistEntries,
  getChecklistFlags,
  getEntityNames,
  getEvolutionChain,
  getFlavorTexts,
  getGameFeatures,
  getItemDetail,
  getItemIcon,
  getLearnableMoveIds,
  getLearnset,
  getLocation,
  getLocationEncounters,
  getMoveDetail,
  getMoveLearners,
  getMoveSummaries,
  getPokemon,
  getPokemonEncounters,
  getPokemonForms,
  getPokemonMedia,
  getPokemonMoves,
  getPokemonProfile,
  getShowdownNames,
  getTeam,
  listAbilities,
  listAbilityDex,
  listChecklistDex,
  listDamageClasses,
  listGamePokemon,
  listGmaxMoves,
  listItems,
  listLocationRegions,
  listLocations,
  listMoves,
  listNatures,
  listPokedex,
  listTeams,
  MOVE_SORT_KEYS,
  POKEDEX_SORT_KEYS,
  resolveGameContext,
  resolveShowdownNames,
  searchQuery,
  type GameContext,
} from '@thedex/db';
import { userSchemaStatements } from '@thedex/db/user';

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
  'media_assets',
  'pokemon_evolution',
  'pokemon_dex_numbers',
  'machines',
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
  e: 'encounters',
  dn: 'pokemon_dex_numbers',
  sft: 'species_flavor_text',
  aft: 'ability_flavor_text',
  ms: 'move_stats_by_vg',
  mc: 'machines',
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
    const match = /^SCAN (?:\w+\.)?(\S+)/.exec(detail);
    if (!match || detail.includes('VIRTUAL TABLE')) return false;
    const name = match[1]!;
    return LARGE_TABLES.has(ALIASES[name] ?? name);
  });
}

/**
 * The app's connection layout: thedex-user.db as main (here in memory, migrated) with the
 * game DB ATTACHed as `data`, so cross-DB queries (capture filter) are planned as on a phone.
 */
export function openAppLikeConnection(dataDbFile: string): Database.Database {
  const app = new Database(':memory:');
  for (const statement of userSchemaStatements()) app.exec(statement);
  app.prepare('ATTACH DATABASE ? AS data').run(dataDbFile);
  return app;
}

/**
 * Runs the hot repository queries (search, Pokédex list with every filter and sort, profile
 * tabs, the Phase 3 encyclopedias, the Phase 4 tools) through a logging Drizzle instance and checks every
 * statement with EXPLAIN QUERY PLAN. The sample ids exist in the real data and the fixtures:
 * Thunderbolt (85), Potion (17), Viridian Forest (155), Kanto (1).
 */
export async function checkHotQueryPlans(
  sqlite: Database.Database,
  sample: { game: string; pokemonId: number },
): Promise<{ checked: number; violations: PlanViolation[] }> {
  const app = openAppLikeConnection(sqlite.name);
  const captured: CapturedQuery[] = [];
  let label = '';
  const db = drizzle(app, {
    logger: { logQuery: (sql, params) => captured.push({ label, sql, params }) },
  });

  const run = async <T>(name: string, fn: () => Promise<T>) => {
    label = name;
    return fn();
  };

  try {
    const ctx: GameContext = await run('resolveGameContext', () =>
      resolveGameContext(db, sample.game, ['pt-BR', 'en']),
    );
    await run('search ≥3 chars', () => searchQuery(db, 'char', ctx));
    await run('search <3 chars', () => searchQuery(db, 'pi', ctx));
    await run('search CJK <3 chars', () =>
      searchQuery(db, 'ピカ', { langChain: ['ja-Hrkt', 'ja', 'en'] }),
    );
    await run('listGamePokemon', () => listGamePokemon(db, ctx, { limit: 50, offset: 0 }));
    for (const key of POKEDEX_SORT_KEYS) {
      await run(`listPokedex sort ${key}`, () =>
        listPokedex(db, ctx, { sort: { key, direction: 'desc' } }),
      );
    }
    await run('listPokedex all filters', () =>
      listPokedex(db, ctx, {
        filters: {
          typeIds: [13, 9],
          generationIds: [1, 4],
          regionIds: [1],
          abilityId: 9,
          eggGroupId: 6,
          tags: ['legendary', 'starter'],
          capture: { scope: 'national', status: 'caught' },
          includeForms: false,
        },
        sort: { key: 'speed', direction: 'desc' },
      }),
    );
    await run('listPokedex not caught', () =>
      listPokedex(db, ctx, { filters: { capture: { scope: 'national', status: 'not-caught' } } }),
    );
    await run('listAbilities', () => listAbilities(db, ctx));
    await run('getPokemon', () => getPokemon(db, sample.pokemonId, ctx));
    await run('getPokemonProfile', () => getPokemonProfile(db, sample.pokemonId, ctx));
    await run('getFlavorTexts', () => getFlavorTexts(db, sample.pokemonId, ctx));
    await run('getAbilityDetail', () => getAbilityDetail(db, 9, ctx));
    await run('getEvolutionChain', () => getEvolutionChain(db, sample.pokemonId, ctx));
    await run('getPokemonForms', () => getPokemonForms(db, sample.pokemonId, ctx));
    await run('getLearnset', () => getLearnset(db, sample.pokemonId, ctx));
    await run('getPokemonMoves', () => getPokemonMoves(db, sample.pokemonId, ctx));
    const kanto = await resolveGameContext(db, 'red-blue', ['en']).catch(() => ctx);
    await run('getPokemonEncounters', () => getPokemonEncounters(db, sample.pokemonId, kanto));
    await run('getPokemonMedia', () => getPokemonMedia(db, sample.pokemonId));

    // Phase 3: Move, Ability, Item, Location, Type and Nature Dex.
    await run('getGameFeatures', () => getGameFeatures(db, ctx));
    await run('listDamageClasses', () => listDamageClasses(db, ctx));
    for (const key of MOVE_SORT_KEYS) {
      await run(`listMoves sort ${key}`, () =>
        listMoves(db, ctx, { sort: { key, direction: 'desc' } }),
      );
    }
    await run('listMoves all filters', () =>
      listMoves(db, ctx, {
        filters: {
          typeIds: [13, 10],
          damageClasses: ['special'],
          generationIds: [1, 4],
          learnableOnly: true,
        },
      }),
    );
    await run('getMoveDetail', () => getMoveDetail(db, 85, ctx));
    await run('getMoveLearners', () => getMoveLearners(db, 85, ctx));
    await run('listGmaxMoves', () => listGmaxMoves(db, ctx, 10));
    await run('listAbilityDex', () => listAbilityDex(db, ctx, { inGameOnly: true }));
    await run('getAbilityHolders', () => getAbilityHolders(db, 65, ctx));
    await run('listItems', () => listItems(db, ctx, { inGameOnly: true }));
    await run('listItems machines', () => listItems(db, ctx, { groups: ['machine'] }));
    await run('getItemDetail', () => getItemDetail(db, 17, ctx));
    await run('getItemIcon', () => getItemIcon(db, 17));
    await run('listLocationRegions', () => listLocationRegions(db, kanto));
    await run('listLocations', () => listLocations(db, kanto, { regionId: 1, inGameOnly: true }));
    await run('getLocation', () => getLocation(db, 155, kanto));
    await run('getLocationEncounters', () => getLocationEncounters(db, 155, kanto));
    await run('listNatures', () => listNatures(db, ctx));

    // Phase 4: team builder, checklist, comparator and calculators.
    await run('listTeams', () => listTeams(db));
    await run('getTeam', () => getTeam(db, '01ARYZ6S41TSV4RRFFQ69G5FAV'));
    await run('listChecklistDex national', () => listChecklistDex(db, ctx, 'national'));
    await run('listChecklistDex game', () => listChecklistDex(db, ctx, 'game'));
    await run('getChecklistEntries', () => getChecklistEntries(db, 'national'));
    await run('getChecklistFlags', () => getChecklistFlags(db, 'national', [sample.pokemonId]));
    await run('getMoveSummaries', () => getMoveSummaries(db, ctx, [85, 44]));
    await run('getLearnableMoveIds', () => getLearnableMoveIds(db, sample.pokemonId, ctx));
    for (const kind of ['pokemon', 'item', 'ability', 'move'] as const) {
      await run(`getEntityNames ${kind}`, () =>
        getEntityNames(db, ctx.langChain, kind, [sample.pokemonId, 17, 65, 85]),
      );
    }
    await run('resolveShowdownNames', () =>
      resolveShowdownNames(db, {
        species: ['Pikachu', 'Vivillon-Pokeball', 'Missingno'],
        items: ['Leftovers', 'Potion'],
        abilities: ['Static'],
        moves: ['Thunderbolt', 'Hidden Power'],
      }),
    );
    await run('getShowdownNames', () =>
      getShowdownNames(db, {
        pokemon: [sample.pokemonId],
        items: [17],
        abilities: [65],
        moves: [85],
      }),
    );

    const violations: PlanViolation[] = [];
    for (const query of captured) {
      const plan = app
        .prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
        .all(...(query.params as never[])) as { detail: string }[];
      for (const detail of scanViolations(plan.map((row) => row.detail))) {
        violations.push({ label: query.label, sql: query.sql, detail });
      }
    }
    return { checked: captured.length, violations };
  } finally {
    app.close();
  }
}
