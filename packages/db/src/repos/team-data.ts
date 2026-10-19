import { sql, type SQL } from 'drizzle-orm';
import { isNatureName, toShowdownId, type NatureName } from '@thedex/engine';
import { pickI18n, sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';
import { pokemonName } from './pokemon';

/** A move as the team builder shows it (RF08.2) and the coverage analysis uses it (RF08.3). */
export interface MoveSummary {
  readonly id: number;
  readonly identifier: string;
  readonly name: string;
  /** Data in the context game's base version group; null when the move is not in it. */
  readonly type: string | null;
  readonly damageClass: string | null;
  readonly power: number | null;
  readonly accuracy: number | null;
  readonly pp: number | null;
}

/** Moves by id, with their data as of the context game. */
export async function getMoveSummaries(
  db: AnySQLiteDatabase,
  ctx: GameContext,
  moveIds: readonly number[],
): Promise<Map<number, MoveSummary>> {
  const ids = [...new Set(moveIds)];
  if (ids.length === 0) return new Map();
  const rows = (await db.all(sql`
    SELECT m.id, m.identifier,
      COALESCE(${pickI18n('move_i18n', 'move_id', sql`m.id`, 'name', ctx.langChain)}, m.identifier) AS name,
      t.identifier AS type, dc.identifier AS damage_class, ms.power, ms.accuracy, ms.pp
    FROM moves m
    LEFT JOIN move_stats_by_vg ms ON ms.move_id = m.id AND ms.version_group_id = ${ctx.versionGroupIds[0] ?? 0}
    LEFT JOIN types t ON t.id = ms.type_id
    LEFT JOIN move_damage_classes dc ON dc.id = ms.damage_class_id
    WHERE m.id IN (${sqlList(ids)})`)) as {
    id: number;
    identifier: string;
    name: string;
    type: string | null;
    damage_class: string | null;
    power: number | null;
    accuracy: number | null;
    pp: number | null;
  }[];
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        identifier: row.identifier,
        name: row.name,
        type: row.type,
        damageClass: row.damage_class,
        power: row.power,
        accuracy: row.accuracy,
        pp: row.pp,
      },
    ]),
  );
}

/** Entity kinds whose names `getEntityNames` resolves. */
export type NamedKind = 'pokemon' | 'item' | 'ability' | 'move';

const NAME_TABLES: Readonly<
  Record<Exclude<NamedKind, 'pokemon'>, readonly [string, string, string]>
> = {
  item: ['items', 'item_i18n', 'item_id'],
  ability: ['abilities', 'ability_i18n', 'ability_id'],
  move: ['moves', 'move_i18n', 'move_id'],
};

/** Names by id in the context languages (identifier when untranslated). */
export async function getEntityNames(
  db: AnySQLiteDatabase,
  langChain: readonly string[],
  kind: NamedKind,
  entityIds: readonly number[],
): Promise<Map<number, string>> {
  const ids = [...new Set(entityIds)];
  if (ids.length === 0) return new Map();
  let rows: { id: number; name: string }[];
  if (kind === 'pokemon') {
    rows = (await db.all(sql`
      SELECT p.id, ${pokemonName(sql`p.id`, langChain)} AS name
      FROM pokemon p WHERE p.id IN (${sqlList(ids)})`)) as { id: number; name: string }[];
  } else {
    const [table, i18n, idColumn] = NAME_TABLES[kind];
    rows = (await db.all(sql`
      SELECT e.id, COALESCE(${pickI18n(i18n, idColumn, sql`e.id`, 'name', langChain)}, e.identifier) AS name
      FROM ${sql.identifier(table)} e WHERE e.id IN (${sqlList(ids)})`)) as {
      id: number;
      name: string;
    }[];
  }
  return new Map(rows.map((row) => [row.id, row.name]));
}

// --- Showdown import/export (RF08.4) ------------------------------------------------------

export interface ShowdownNameQuery {
  readonly species?: readonly string[];
  readonly items?: readonly string[];
  readonly abilities?: readonly string[];
  readonly moves?: readonly string[];
}

/** Showdown ID (`toShowdownId`) → PokeAPI id, per kind. Unknown names are simply absent. */
export interface ShowdownIdMaps {
  readonly pokemon: ReadonlyMap<string, number>;
  readonly items: ReadonlyMap<string, number>;
  readonly abilities: ReadonlyMap<string, number>;
  readonly moves: ReadonlyMap<string, number>;
}

/**
 * Showdown ID → row id for one table: `ps_id` first, then the PokeAPI identifier without
 * hyphens for entities Showdown does not have (Potion, Rare Candy…).
 */
async function idsByPsId(
  db: AnySQLiteDatabase,
  table: string,
  names: readonly string[] | undefined,
  /** Rows to rank last among equal Showdown IDs. */
  rankLast?: SQL,
): Promise<Map<string, number>> {
  const psIds = [...new Set((names ?? []).map(toShowdownId).filter((id) => id !== ''))];
  if (psIds.length === 0) return new Map();
  const order = sql`ORDER BY ${rankLast ? sql`${rankLast}, ` : sql``}id`;
  const rows = (await db.all(sql`
    SELECT id, ps_id FROM ${sql.identifier(table)} WHERE ps_id IN (${sqlList(psIds)})
    ${order}`)) as { id: number; ps_id: string }[];
  const result = new Map<string, number>();
  for (const row of rows) if (!result.has(row.ps_id)) result.set(row.ps_id, row.id);
  const missing = psIds.filter((id) => !result.has(id));
  if (missing.length > 0) {
    const fallback = (await db.all(sql`
      SELECT id, replace(identifier, '-', '') AS ps_id FROM ${sql.identifier(table)}
      WHERE replace(identifier, '-', '') IN (${sqlList(missing)}) ${order}`)) as {
      id: number;
      ps_id: string;
    }[];
    for (const row of fallback) if (!result.has(row.ps_id)) result.set(row.ps_id, row.id);
  }
  return result;
}

/**
 * Resolves Showdown names (any spelling `toShowdownId` normalizes) to PokeAPI ids. Species
 * also match cosmetic forms (`Vivillon-Pokeball` → Vivillon); Z-Crystals prefer the held item.
 */
export async function resolveShowdownNames(
  db: AnySQLiteDatabase,
  query: ShowdownNameQuery,
): Promise<ShowdownIdMaps> {
  const pokemon = await idsByPsId(db, 'pokemon', query.species);
  const missing = [...new Set((query.species ?? []).map(toShowdownId))].filter(
    (id) => id !== '' && !pokemon.has(id),
  );
  if (missing.length > 0) {
    const forms = (await db.all(sql`
      SELECT pokemon_id, ps_id FROM pokemon_forms WHERE ps_id IN (${sqlList(missing)})
      ORDER BY id`)) as { pokemon_id: number; ps_id: string }[];
    for (const form of forms)
      if (!pokemon.has(form.ps_id)) pokemon.set(form.ps_id, form.pokemon_id);
  }
  return {
    pokemon,
    items: await idsByPsId(db, 'items', query.items, sql`identifier LIKE '%--bag'`),
    abilities: await idsByPsId(db, 'abilities', query.abilities),
    moves: await idsByPsId(db, 'moves', query.moves),
  };
}

/** Showdown nature name → engine identifier (`Adamant` → `adamant`). */
export function natureFromShowdown(name: string): NatureName | null {
  const id = toShowdownId(name);
  return isNatureName(id) ? id : null;
}

export interface ShowdownNameMaps {
  readonly pokemon: ReadonlyMap<number, string>;
  readonly items: ReadonlyMap<number, string>;
  readonly abilities: ReadonlyMap<number, string>;
  readonly moves: ReadonlyMap<number, string>;
}

async function psNames(
  db: AnySQLiteDatabase,
  table: string,
  ids: readonly number[] | undefined,
  english: (id: SQL) => SQL,
): Promise<Map<number, string>> {
  const unique = [...new Set(ids ?? [])];
  if (unique.length === 0) return new Map();
  const rows = (await db.all(sql`
    SELECT p.id, COALESCE(p.ps_name, ${english(sql`p.id`)}, p.identifier) AS name
    FROM ${sql.identifier(table)} p WHERE p.id IN (${sqlList(unique)})`)) as {
    id: number;
    name: string;
  }[];
  return new Map(rows.map((row) => [row.id, row.name]));
}

/** Showdown display names by PokeAPI id (English names where Showdown has none). */
export async function getShowdownNames(
  db: AnySQLiteDatabase,
  ids: {
    readonly pokemon?: readonly number[];
    readonly items?: readonly number[];
    readonly abilities?: readonly number[];
    readonly moves?: readonly number[];
  },
): Promise<ShowdownNameMaps> {
  const en = ['en'];
  return {
    pokemon: await psNames(db, 'pokemon', ids.pokemon, (id) => pokemonName(id, en)),
    items: await psNames(db, 'items', ids.items, (id) =>
      pickI18n('item_i18n', 'item_id', id, 'name', en),
    ),
    abilities: await psNames(db, 'abilities', ids.abilities, (id) =>
      pickI18n('ability_i18n', 'ability_id', id, 'name', en),
    ),
    moves: await psNames(db, 'moves', ids.moves, (id) =>
      pickI18n('move_i18n', 'move_id', id, 'name', en),
    ),
  };
}
