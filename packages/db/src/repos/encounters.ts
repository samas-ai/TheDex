import { sql } from 'drizzle-orm';
import { pickI18n, sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';
import type { NamedEntity } from './catalog';

/** One encounter row of the profile's "Locations" tab (RF02.7). */
export interface EncounterEntry {
  readonly location: NamedEntity;
  /** Sub-area name (null when the location has a single unnamed area). */
  readonly areaName: string | null;
  readonly areaId: number;
  /** walk | surf | old-rod | good-rod | super-rod | rock-smash | headbutt | gift … */
  readonly method: NamedEntity;
  readonly minLevel: number;
  readonly maxLevel: number;
  /** Summed slot chance in percent (null when the game model has none). */
  readonly ratePct: number | null;
  /** Conditions such as time of day, season or swarm (empty = always). */
  readonly conditions: readonly NamedEntity[];
  /** Versions of the game where this exact encounter happens (e.g. Red and Blue). */
  readonly versions: readonly NamedEntity[];
}

interface GroupRow {
  version_id: number;
  version_identifier: string;
  version_name: string | null;
  location_area_id: number;
  area_name: string | null;
  location_id: number;
  location_identifier: string;
  location_name: string | null;
  method_id: number;
  method_identifier: string;
  method_name: string | null;
  method_order: number | null;
  conditions: string | null;
  min_level: number;
  max_level: number;
  rate: number | null;
}

/**
 * Wild encounters of a variety in the context game's versions. Slots are summed per area,
 * method and condition set; identical results across versions are merged.
 */
export async function getPokemonEncounters(
  db: AnySQLiteDatabase,
  pokemonId: number,
  ctx: GameContext,
): Promise<EncounterEntry[]> {
  if (ctx.versionIds.length === 0) return [];
  const { langChain } = ctx;
  const rows = (await db.all(sql`
    SELECT g.version_id, v.identifier AS version_identifier,
      ${pickI18n('version_i18n', 'version_id', sql`v.id`, 'name', langChain)} AS version_name,
      g.location_area_id,
      ${pickI18n('location_area_i18n', 'location_area_id', sql`la.id`, 'name', langChain)} AS area_name,
      l.id AS location_id, l.identifier AS location_identifier,
      ${pickI18n('location_i18n', 'location_id', sql`l.id`, 'name', langChain)} AS location_name,
      em.id AS method_id, em.identifier AS method_identifier, em.sort_order AS method_order,
      ${pickI18n('encounter_method_i18n', 'method_id', sql`em.id`, 'name', langChain)} AS method_name,
      g.conditions, g.min_level, g.max_level, g.rate
    FROM (
      SELECT e.version_id, e.location_area_id, e.method_id,
        (SELECT group_concat(id, ',') FROM (
           SELECT condition_value_id AS id FROM encounter_condition_value_map
           WHERE encounter_id = e.id ORDER BY condition_value_id)) AS conditions,
        min(e.min_level) AS min_level, max(e.max_level) AS max_level, sum(e.rate_pct) AS rate
      FROM encounters e
      WHERE e.pokemon_id = ${pokemonId} AND e.version_id IN (${sqlList(ctx.versionIds)})
      GROUP BY e.version_id, e.location_area_id, e.method_id, conditions
    ) g
    JOIN versions v ON v.id = g.version_id
    JOIN location_areas la ON la.id = g.location_area_id
    JOIN locations l ON l.id = la.location_id
    JOIN encounter_methods em ON em.id = g.method_id
    ORDER BY location_name, la.id, em.sort_order, g.conditions, g.version_id`)) as GroupRow[];
  if (rows.length === 0) return [];

  const conditionIds = [
    ...new Set(rows.flatMap((row) => (row.conditions ? row.conditions.split(',') : []))),
  ].map(Number);
  const conditionNames = new Map<number, NamedEntity>();
  if (conditionIds.length > 0) {
    const conditionRows = (await db.all(sql`
      SELECT cv.id, cv.identifier,
        ${pickI18n('encounter_condition_value_i18n', 'condition_value_id', sql`cv.id`, 'name', langChain)} AS name
      FROM encounter_condition_values cv WHERE cv.id IN (${sqlList(conditionIds)})`)) as {
      id: number;
      identifier: string;
      name: string | null;
    }[];
    for (const row of conditionRows) {
      conditionNames.set(row.id, {
        id: row.id,
        identifier: row.identifier,
        name: row.name ?? row.identifier,
      });
    }
  }

  const merged = new Map<string, { entry: EncounterEntry; versions: NamedEntity[] }>();
  for (const row of rows) {
    const key = [
      row.location_area_id,
      row.method_id,
      row.conditions ?? '',
      row.min_level,
      row.max_level,
      row.rate ?? '',
    ].join('|');
    const version: NamedEntity = {
      id: row.version_id,
      identifier: row.version_identifier,
      name: row.version_name ?? row.version_identifier,
    };
    const existing = merged.get(key);
    if (existing) {
      existing.versions.push(version);
      continue;
    }
    const versions = [version];
    merged.set(key, {
      versions,
      entry: {
        location: {
          id: row.location_id,
          identifier: row.location_identifier,
          name: row.location_name ?? row.location_identifier,
        },
        areaId: row.location_area_id,
        areaName: row.area_name || null,
        method: {
          id: row.method_id,
          identifier: row.method_identifier,
          name: row.method_name ?? row.method_identifier,
        },
        minLevel: row.min_level,
        maxLevel: row.max_level,
        ratePct: row.rate,
        conditions: (row.conditions ? row.conditions.split(',') : [])
          .map((id) => conditionNames.get(Number(id)))
          .filter((condition): condition is NamedEntity => condition !== undefined),
        versions,
      },
    });
  }
  return [...merged.values()].map(({ entry }) => entry);
}
