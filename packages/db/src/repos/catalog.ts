import { sql } from 'drizzle-orm';
import { pickI18n } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';

/** A small lookup entity with a localized name (filter chips, pickers, badges). */
export interface NamedEntity {
  readonly id: number;
  readonly identifier: string;
  readonly name: string;
}

type Row = { id: number; identifier: string; name: string | null };
const named = (rows: Row[]): NamedEntity[] =>
  rows.map((row) => ({ id: row.id, identifier: row.identifier, name: row.name ?? row.identifier }));

/** The battle types that exist in the context generation (Fairy from Gen 6, Dark/Steel 2). */
export async function listTypes(db: AnySQLiteDatabase, ctx: GameContext): Promise<NamedEntity[]> {
  return named(
    (await db.all(sql`
      SELECT t.id, t.identifier, ${pickI18n('type_i18n', 'type_id', sql`t.id`, 'name', ctx.langChain)} AS name
      FROM types t WHERE t.id < 10000 AND t.generation_id <= ${ctx.generationId}
        AND t.identifier NOT IN ('stellar', 'unknown', 'shadow')
      ORDER BY t.id`)) as Row[],
  );
}

/** Permanent stats (HP … Speed, plus the Gen 1 Special) with localized names. */
export async function listStats(db: AnySQLiteDatabase, ctx: GameContext): Promise<NamedEntity[]> {
  return named(
    (await db.all(sql`
      SELECT s.id, s.identifier, ${pickI18n('stat_i18n', 'stat_id', sql`s.id`, 'name', ctx.langChain)} AS name
      FROM stats s WHERE s.is_battle_only = 0 ORDER BY s.id`)) as Row[],
  );
}

/** Move categories (physical, special, status) with localized names. */
export async function listDamageClasses(
  db: AnySQLiteDatabase,
  ctx: Pick<GameContext, 'langChain'>,
): Promise<NamedEntity[]> {
  return named(
    (await db.all(sql`
      SELECT d.id, d.identifier, ${pickI18n('move_damage_class_i18n', 'damage_class_id', sql`d.id`, 'name', ctx.langChain)} AS name
      FROM move_damage_classes d ORDER BY d.id`)) as Row[],
  );
}

/** Generations up to the context generation (species origin filter, RF01.3). */
export async function listGenerations(
  db: AnySQLiteDatabase,
  ctx: GameContext,
): Promise<NamedEntity[]> {
  return named(
    (await db.all(sql`
      SELECT g.id, g.identifier, ${pickI18n('generation_i18n', 'generation_id', sql`g.id`, 'name', ctx.langChain)} AS name
      FROM generations g WHERE g.id <= ${ctx.generationId} ORDER BY g.id`)) as Row[],
  );
}

/** Regions with a main-series regional Pokédex (region filter, RF01.3). */
export async function listRegions(db: AnySQLiteDatabase, ctx: GameContext): Promise<NamedEntity[]> {
  return named(
    (await db.all(sql`
      SELECT r.id, r.identifier, ${pickI18n('region_i18n', 'region_id', sql`r.id`, 'name', ctx.langChain)} AS name
      FROM regions r
      WHERE EXISTS (SELECT 1 FROM pokedexes d WHERE d.region_id = r.id AND d.is_main_series = 1)
      ORDER BY r.id`)) as Row[],
  );
}

/** Egg groups (introduced in Gen 2; empty for Gen 1 games). */
export async function listEggGroups(
  db: AnySQLiteDatabase,
  ctx: GameContext,
): Promise<NamedEntity[]> {
  if (ctx.generationId < 2) return [];
  return named(
    (await db.all(sql`
      SELECT e.id, e.identifier, ${pickI18n('egg_group_i18n', 'egg_group_id', sql`e.id`, 'name', ctx.langChain)} AS name
      FROM egg_groups e ORDER BY name`)) as Row[],
  );
}

/** Abilities some Pokémon has in the context generation (abilities start in Gen 3). */
export async function listAbilities(
  db: AnySQLiteDatabase,
  ctx: GameContext,
): Promise<NamedEntity[]> {
  return named(
    (await db.all(sql`
      SELECT a.id, a.identifier, ${pickI18n('ability_i18n', 'ability_id', sql`a.id`, 'name', ctx.langChain)} AS name
      FROM (SELECT DISTINCT ability_id FROM pokemon_abilities_by_gen WHERE generation_id = ${ctx.generationId}) used
      JOIN abilities a ON a.id = used.ability_id
      ORDER BY name`)) as Row[],
  );
}

/** Species categories present in the data (starter, legendary, mythical, ultra_beast…). */
export async function listSpeciesTags(db: AnySQLiteDatabase): Promise<string[]> {
  const rows = (await db.all(sql`SELECT DISTINCT tag FROM species_tags ORDER BY tag`)) as {
    tag: string;
  }[];
  return rows.map((row) => row.tag);
}

/** Languages with translated game data, in PokeAPI order (game-data language picker). */
export async function listGameLanguages(db: AnySQLiteDatabase): Promise<string[]> {
  const rows = (await db.all(
    sql`SELECT code FROM languages WHERE has_game_data = 1 ORDER BY sort_order`,
  )) as { code: string }[];
  return rows.map((row) => row.code);
}
