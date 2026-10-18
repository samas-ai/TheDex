import { sql, type SQL } from 'drizzle-orm';
import { pickI18n, sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';

export interface PokemonStats {
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly specialAttack: number;
  readonly specialDefense: number;
  readonly speed: number;
  /** Gen 1 unified Special (null in Gen 2+). */
  readonly special: number | null;
  readonly bst: number;
}

export interface PokemonAbility {
  readonly id: number;
  readonly identifier: string;
  readonly name: string;
  readonly slot: number;
  readonly isHidden: boolean;
}

export interface PokemonDetail {
  readonly id: number;
  readonly identifier: string;
  readonly speciesId: number;
  readonly isDefault: boolean;
  readonly name: string;
  readonly genus: string | null;
  readonly heightDm: number;
  readonly weightHg: number;
  /** Type identifiers in slot order, as of the context generation. */
  readonly types: readonly string[];
  readonly abilities: readonly PokemonAbility[];
  /** Base stats as of the context generation (null if it did not exist yet). */
  readonly stats: PokemonStats | null;
}

/**
 * Display name of a variety: the species name for default varieties ("Ogerpon", not "Teal
 * Mask Ogerpon"), the form's full name for alternate ones ("Mega Charizard X"). Expects the
 * variety aliased as `p` in the enclosing query.
 */
export function pokemonName(idExpression: SQL, langChain: readonly string[]): SQL {
  return sql`COALESCE(
    CASE WHEN p.is_default = 0 THEN
      (SELECT ${pickI18n('form_i18n', 'form_id', sql`f.id`, 'pokemon_name', langChain)}
         FROM pokemon_forms f WHERE f.pokemon_id = ${idExpression} AND f.is_default = 1 LIMIT 1)
    END,
    ${pickI18n('species_i18n', 'species_id', sql`p.species_id`, 'name', langChain)},
    p.identifier)`;
}

/** Full detail of one variety resolved for the context generation and languages. */
export async function getPokemon(
  db: AnySQLiteDatabase,
  pokemonId: number,
  ctx: GameContext,
): Promise<PokemonDetail | null> {
  const { langChain, generationId } = ctx;
  const row = (await db.get(sql`
    SELECT p.id, p.identifier, p.species_id, p.is_default, p.height_dm, p.weight_hg,
      ${pokemonName(sql`p.id`, langChain)} AS name,
      ${pickI18n('species_i18n', 'species_id', sql`p.species_id`, 'genus', langChain)} AS genus
    FROM pokemon p WHERE p.id = ${pokemonId}`)) as
    | {
        id: number;
        identifier: string;
        species_id: number;
        is_default: number;
        height_dm: number;
        weight_hg: number;
        name: string;
        genus: string | null;
      }
    | undefined;
  if (!row) return null;

  const typeRows = (await db.all(sql`
    SELECT t.identifier FROM pokemon_types_by_gen pt JOIN types t ON t.id = pt.type_id
    WHERE pt.pokemon_id = ${pokemonId} AND pt.generation_id = ${generationId}
    ORDER BY pt.slot`)) as { identifier: string }[];

  const abilityRows = (await db.all(sql`
    SELECT a.id, a.identifier, pa.slot, pa.is_hidden,
      ${pickI18n('ability_i18n', 'ability_id', sql`a.id`, 'name', langChain)} AS name
    FROM pokemon_abilities_by_gen pa JOIN abilities a ON a.id = pa.ability_id
    WHERE pa.pokemon_id = ${pokemonId} AND pa.generation_id = ${generationId}
    ORDER BY pa.slot`)) as {
    id: number;
    identifier: string;
    slot: number;
    is_hidden: number;
    name: string | null;
  }[];

  const stats = (await db.get(sql`
    SELECT hp, attack, defense, special_attack, special_defense, speed, special, bst
    FROM pokemon_stats_by_gen WHERE pokemon_id = ${pokemonId} AND generation_id = ${generationId}`)) as
    | {
        hp: number;
        attack: number;
        defense: number;
        special_attack: number;
        special_defense: number;
        speed: number;
        special: number | null;
        bst: number;
      }
    | undefined;

  return {
    id: row.id,
    identifier: row.identifier,
    speciesId: row.species_id,
    isDefault: row.is_default === 1,
    name: row.name,
    genus: row.genus,
    heightDm: row.height_dm,
    weightHg: row.weight_hg,
    types: typeRows.map((t) => t.identifier),
    abilities: abilityRows.map((a) => ({
      id: a.id,
      identifier: a.identifier,
      name: a.name ?? a.identifier,
      slot: a.slot,
      isHidden: a.is_hidden === 1,
    })),
    stats: stats
      ? {
          hp: stats.hp,
          attack: stats.attack,
          defense: stats.defense,
          specialAttack: stats.special_attack,
          specialDefense: stats.special_defense,
          speed: stats.speed,
          special: stats.special,
          bst: stats.bst,
        }
      : null,
  };
}

export interface PokemonListItem {
  readonly id: number;
  readonly identifier: string;
  readonly speciesId: number;
  readonly name: string;
  readonly regionalNumber: number | null;
  readonly types: readonly string[];
  readonly bst: number | null;
}

/** Varieties available in the context game, ordered by regional then national number. */
export async function listGamePokemon(
  db: AnySQLiteDatabase,
  ctx: GameContext,
  page: { limit: number; offset: number } = { limit: 50, offset: 0 },
): Promise<PokemonListItem[]> {
  const { langChain, generationId, gameId } = ctx;
  const rows = (await db.all(sql`
    SELECT p.id, p.identifier, p.species_id, gp.regional_number,
      ${pokemonName(sql`p.id`, langChain)} AS name,
      (SELECT group_concat(identifier, ',') FROM (
         SELECT t.identifier FROM pokemon_types_by_gen pt JOIN types t ON t.id = pt.type_id
         WHERE pt.pokemon_id = p.id AND pt.generation_id = ${generationId} ORDER BY pt.slot)) AS types,
      s.bst
    FROM game_pokemon gp
    JOIN pokemon p ON p.id = gp.pokemon_id
    LEFT JOIN pokemon_stats_by_gen s ON s.pokemon_id = p.id AND s.generation_id = ${generationId}
    WHERE gp.game_id = ${gameId}
    ORDER BY gp.regional_number IS NULL, gp.regional_number, p.species_id, p.id
    LIMIT ${page.limit} OFFSET ${page.offset}`)) as {
    id: number;
    identifier: string;
    species_id: number;
    regional_number: number | null;
    name: string;
    types: string | null;
    bst: number | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    identifier: row.identifier,
    speciesId: row.species_id,
    name: row.name,
    regionalNumber: row.regional_number,
    types: row.types ? row.types.split(',') : [],
    bst: row.bst,
  }));
}

/** Move ids a variety learns in the context game, grouped by learn method identifier. */
export async function getLearnset(
  db: AnySQLiteDatabase,
  pokemonId: number,
  ctx: GameContext,
): Promise<Record<string, { moveId: number; level: number }[]>> {
  const rows = (await db.all(sql`
    SELECT DISTINCT m.identifier AS method, pm.move_id, pm.level
    FROM pokemon_moves pm JOIN move_learn_methods m ON m.id = pm.method_id
    WHERE pm.pokemon_id = ${pokemonId} AND pm.version_group_id IN (${sqlList(ctx.versionGroupIds)})
    ORDER BY m.id, pm.level, pm.move_id`)) as { method: string; move_id: number; level: number }[];
  const result: Record<string, { moveId: number; level: number }[]> = {};
  for (const row of rows)
    (result[row.method] ??= []).push({ moveId: row.move_id, level: row.level });
  return result;
}
