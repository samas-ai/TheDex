import type { BuildContext } from '../context';
import type { SqlValue } from '../values';

interface GameRow {
  id: number;
  versionGroupIds: number[];
  pokedexIds: number[];
  hasMega: boolean;
  hasDynamax: boolean;
}

function idMap(ctx: BuildContext, table: string): Map<string, number> {
  return new Map(
    ctx
      .all<{ id: number; identifier: string }>(`SELECT id, identifier FROM "${table}"`)
      .map((row) => [row.identifier, row.id]),
  );
}

function resolve(map: Map<string, number>, identifier: string, what: string): number {
  const id = map.get(identifier);
  if (id === undefined) throw new Error(`games.json: unknown ${what} "${identifier}"`);
  return id;
}

/** Curated games + their version groups, versions, pokedexes and localized names. */
function insertGames(ctx: BuildContext): GameRow[] {
  const versionGroups = idMap(ctx, 'version_groups');
  const pokedexes = idMap(ctx, 'pokedexes');
  const vgGeneration = new Map(
    ctx
      .all<{ id: number; generation_id: number }>('SELECT id, generation_id FROM version_groups')
      .map((row) => [row.id, row.generation_id]),
  );

  const games: GameRow[] = [];
  const seenVersionGroups = new Set<number>();
  const gameRows: SqlValue[][] = [];
  const vgRows: SqlValue[][] = [];
  const dexRows: SqlValue[][] = [];

  ctx.curated.games.forEach((game, index) => {
    const id = index + 1;
    const versionGroupIds = game.versionGroups.map((vg) =>
      resolve(versionGroups, vg, 'version group'),
    );
    const pokedexIds = game.pokedexes.map((dex) => resolve(pokedexes, dex, 'pokedex'));
    for (const vg of versionGroupIds) {
      if (seenVersionGroups.has(vg)) throw new Error(`games.json: version group ${vg} used twice`);
      seenVersionGroups.add(vg);
    }
    const mechanics = new Set(game.mechanics);
    const baseVg = versionGroupIds[0]!;
    gameRows.push([
      id,
      game.identifier,
      vgGeneration.get(baseVg) ?? null,
      index,
      mechanics.has('mega') ? 1 : 0,
      mechanics.has('z') ? 1 : 0,
      mechanics.has('dynamax') ? 1 : 0,
      mechanics.has('tera') ? 1 : 0,
    ]);
    versionGroupIds.forEach((vg, order) => vgRows.push([id, vg, order === 0 ? 1 : 0, order]));
    pokedexIds.forEach((dex, order) => dexRows.push([id, dex, order]));
    games.push({
      id,
      versionGroupIds,
      pokedexIds,
      hasMega: mechanics.has('mega'),
      hasDynamax: mechanics.has('dynamax'),
    });
  });

  const unmapped = [...versionGroups.entries()].filter(([, vg]) => !seenVersionGroups.has(vg));
  if (unmapped.length > 0) {
    ctx.log(`  ! version groups without a game: ${unmapped.map(([name]) => name).join(', ')}`);
  }

  ctx.insert(
    'games',
    [
      'id',
      'identifier',
      'generation_id',
      'sort_order',
      'has_mega',
      'has_z',
      'has_dynamax',
      'has_tera',
    ],
    gameRows,
  );
  ctx.insert(
    'game_version_groups',
    ['game_id', 'version_group_id', 'is_base', 'sort_order'],
    vgRows,
  );
  ctx.insert('game_pokedexes', ['game_id', 'pokedex_id', 'sort_order'], dexRows);
  ctx.db.exec(`
    INSERT INTO game_versions (game_id, version_id)
    SELECT gvg.game_id, v.id FROM game_version_groups gvg
    JOIN versions v ON v.version_group_id = gvg.version_group_id;`);

  // Localized game name = names of the base version group's versions, joined by " / ".
  ctx.db.exec(`
    INSERT INTO game_i18n (game_id, lang, name)
    SELECT gvg.game_id, vi.lang, group_concat(vi.name, ' / ')
    FROM (SELECT gvg.game_id, v.id AS version_id FROM game_version_groups gvg
          JOIN versions v ON v.version_group_id = gvg.version_group_id
          WHERE gvg.is_base = 1 ORDER BY v.id) gvg
    JOIN version_i18n vi ON vi.version_id = gvg.version_id
    GROUP BY gvg.game_id, vi.lang;`);
  return games;
}

/**
 * Which varieties exist in each game: species in the game's pokedexes (default variety),
 * every variety with a learnset in the game's version groups, and Mega/Primal/G-Max forms
 * of present species when the game has that mechanic.
 */
function insertGamePokemon(ctx: BuildContext, games: readonly GameRow[]): number {
  const defaultBySpecies = new Map(
    ctx
      .all<{ id: number; species_id: number }>(
        'SELECT id, species_id FROM pokemon WHERE is_default = 1',
      )
      .map((row) => [row.species_id, row.id]),
  );
  const varieties = ctx.all<{ id: number; species_id: number; identifier: string }>(
    'SELECT id, species_id, identifier FROM pokemon WHERE is_default = 0',
  );
  const speciesOf = new Map(
    ctx
      .all<{ id: number; species_id: number }>('SELECT id, species_id FROM pokemon')
      .map((r) => [r.id, r.species_id]),
  );

  const rows: SqlValue[][] = [];
  for (const game of games) {
    const regional = new Map<number, { pokedexId: number; number: number }>();
    for (const pokedexId of game.pokedexIds) {
      for (const entry of ctx.all<{ species_id: number; number: number }>(
        'SELECT species_id, number FROM pokemon_dex_numbers WHERE pokedex_id = ?',
        pokedexId,
      )) {
        if (!regional.has(entry.species_id)) {
          regional.set(entry.species_id, { pokedexId, number: entry.number });
        }
      }
    }

    const present = new Set<number>();
    for (const speciesId of regional.keys()) {
      const pokemonId = defaultBySpecies.get(speciesId);
      if (pokemonId !== undefined) present.add(pokemonId);
    }
    const placeholders = game.versionGroupIds.map(() => '?').join(', ');
    for (const row of ctx.all<{ pokemon_id: number }>(
      `SELECT DISTINCT pokemon_id FROM pokemon_moves WHERE version_group_id IN (${placeholders})`,
      ...game.versionGroupIds,
    )) {
      present.add(row.pokemon_id);
    }

    const presentSpecies = new Set([...present].map((id) => speciesOf.get(id)));
    for (const variety of varieties) {
      if (!presentSpecies.has(variety.species_id)) continue;
      const isMega = /-mega(-|$)|-primal$/.test(variety.identifier);
      const isGmax = variety.identifier.endsWith('-gmax');
      if ((isMega && game.hasMega) || (isGmax && game.hasDynamax)) present.add(variety.id);
    }

    for (const pokemonId of present) {
      const dex = regional.get(speciesOf.get(pokemonId) ?? -1);
      rows.push([game.id, pokemonId, dex?.pokedexId ?? null, dex?.number ?? null]);
    }
  }
  return ctx.insert(
    'game_pokemon',
    ['game_id', 'pokemon_id', 'pokedex_id', 'regional_number'],
    rows,
  );
}

export function deriveGames(ctx: BuildContext): void {
  const games = insertGames(ctx);
  ctx.log(`  games: ${games.length}`);
  ctx.log(`  game_pokemon: ${insertGamePokemon(ctx, games)}`);
}
