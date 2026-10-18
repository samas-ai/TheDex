import { sql, type SQL } from 'drizzle-orm';
import { splitOverworldProse, stripProseMarkup } from '../prose';
import { pickI18n, sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';
import type { NamedEntity } from './catalog';
import { latestFlavorText } from './flavor';
import { pokemonName } from './pokemon';

const strip = (text: string | null) => (text === null ? null : stripProseMarkup(text));

export interface AbilityFilters {
  /** Generations the ability was introduced in (any). */
  readonly generationIds?: readonly number[];
  /** Only abilities some Pokémon available in the context game has. */
  readonly inGameOnly?: boolean;
}

export interface AbilityListEntry extends NamedEntity {
  readonly generationId: number;
  readonly shortEffect: string | null;
}

/**
 * Ability Dex (RF04.1): main-series abilities that exist in the context generation (abilities
 * arrived in Gen 3, so Gen 1–2 games have none), by name.
 */
export async function listAbilityDex(
  db: AnySQLiteDatabase,
  ctx: GameContext,
  filters: AbilityFilters = {},
): Promise<AbilityListEntry[]> {
  const { langChain, generationId } = ctx;
  const where: SQL[] = [sql`a.is_main_series = 1`, sql`a.generation_id <= ${generationId}`];
  if (filters.generationIds?.length) {
    where.push(sql`a.generation_id IN (${sqlList(filters.generationIds)})`);
  }
  if (filters.inGameOnly) {
    where.push(sql`EXISTS (SELECT 1 FROM pokemon_abilities_by_gen pa
      JOIN game_pokemon gp ON gp.game_id = ${ctx.gameId} AND gp.pokemon_id = pa.pokemon_id
      WHERE pa.generation_id = ${generationId} AND pa.ability_id = a.id)`);
  }
  const rows = (await db.all(sql`
    SELECT a.id, a.identifier, a.generation_id,
      COALESCE(${pickI18n('ability_i18n', 'ability_id', sql`a.id`, 'name', langChain)}, a.identifier) AS name,
      ${pickI18n('ability_prose_i18n', 'ability_id', sql`a.id`, 'short_effect', langChain)} AS short_effect
    FROM abilities a
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY name COLLATE NOCASE, a.id`)) as {
    id: number;
    identifier: string;
    generation_id: number;
    name: string;
    short_effect: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    identifier: row.identifier,
    name: row.name,
    generationId: row.generation_id,
    shortEffect: strip(row.short_effect),
  }));
}

export interface AbilityDetail extends NamedEntity {
  readonly generationId: number;
  readonly shortEffect: string | null;
  readonly effect: string | null;
  /** Effect outside battle (RF04.1), curated; null when the ability has none. */
  readonly overworldEffect: string | null;
  /** In-game description from the context game, else the latest earlier one. */
  readonly flavorText: string | null;
}

/** Ability detail (RF02.2 sheet, RF04.1): battle and field effects + in-game description. */
export async function getAbilityDetail(
  db: AnySQLiteDatabase,
  abilityId: number,
  ctx: GameContext,
): Promise<AbilityDetail | null> {
  const { langChain } = ctx;
  const proseColumn = (column: string) =>
    pickI18n('ability_prose_i18n', 'ability_id', sql`a.id`, column, langChain);
  const row = (await db.get(sql`
    SELECT a.id, a.identifier, a.generation_id,
      ${pickI18n('ability_i18n', 'ability_id', sql`a.id`, 'name', langChain)} AS name,
      ${proseColumn('short_effect')} AS short_effect, ${proseColumn('effect')} AS effect,
      ${proseColumn('overworld_effect')} AS overworld_effect
    FROM abilities a WHERE a.id = ${abilityId}`)) as
    | {
        id: number;
        identifier: string;
        generation_id: number;
        name: string | null;
        short_effect: string | null;
        effect: string | null;
        overworld_effect: string | null;
      }
    | undefined;
  if (!row) return null;
  // PokeAPI's English prose ends some effects with an "Overworld:" paragraph: shown apart,
  // and only when the curated text (verified, translated) is missing.
  const prose = row.effect === null ? null : splitOverworldProse(stripProseMarkup(row.effect));
  return {
    id: row.id,
    identifier: row.identifier,
    name: row.name ?? row.identifier,
    generationId: row.generation_id,
    shortEffect: strip(row.short_effect),
    effect: prose?.battle || null,
    overworldEffect: row.overworld_effect ?? prose?.overworld ?? null,
    flavorText: await latestFlavorText(db, 'ability_flavor_text', abilityId, ctx),
  };
}

export interface AbilityHolder {
  readonly pokemonId: number;
  readonly speciesId: number;
  readonly name: string;
  readonly isDefault: boolean;
  readonly types: readonly string[];
  readonly isHidden: boolean;
  /** Whether the variety is available in the context game. */
  readonly inGame: boolean;
}

/** Varieties with the ability in the context generation, regular and hidden (RF04.2). */
export async function getAbilityHolders(
  db: AnySQLiteDatabase,
  abilityId: number,
  ctx: GameContext,
): Promise<AbilityHolder[]> {
  const { langChain, generationId } = ctx;
  const rows = (await db.all(sql`
    SELECT p.id, p.species_id, p.is_default, ${pokemonName(sql`p.id`, langChain)} AS name,
      min(pa.is_hidden) AS is_hidden,
      (SELECT group_concat(identifier, ',') FROM (
         SELECT t.identifier FROM pokemon_types_by_gen pt JOIN types t ON t.id = pt.type_id
         WHERE pt.pokemon_id = p.id AND pt.generation_id = ${generationId} ORDER BY pt.slot)) AS types,
      EXISTS (SELECT 1 FROM game_pokemon gp
              WHERE gp.game_id = ${ctx.gameId} AND gp.pokemon_id = p.id) AS in_game
    FROM pokemon_abilities_by_gen pa JOIN pokemon p ON p.id = pa.pokemon_id
    WHERE pa.generation_id = ${generationId} AND pa.ability_id = ${abilityId}
    GROUP BY p.id
    ORDER BY p.species_id, p.is_default DESC, p.id`)) as {
    id: number;
    species_id: number;
    is_default: number;
    name: string;
    is_hidden: number;
    types: string | null;
    in_game: number;
  }[];
  return rows.map((row) => ({
    pokemonId: row.id,
    speciesId: row.species_id,
    name: row.name,
    isDefault: row.is_default === 1,
    types: row.types ? row.types.split(',') : [],
    isHidden: row.is_hidden === 1,
    inGame: row.in_game === 1,
  }));
}
