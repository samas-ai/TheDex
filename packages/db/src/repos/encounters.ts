import { sql } from 'drizzle-orm';
import { pickI18n, sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';
import type { NamedEntity } from './catalog';
import { pokemonName } from './pokemon';

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

/** Columns shared by the grouped encounter queries. */
interface GroupRow {
  version_id: number;
  version_identifier: string;
  version_name: string | null;
  location_area_id: number;
  area_name: string | null;
  method_id: number;
  method_identifier: string;
  method_name: string | null;
  conditions: string | null;
  min_level: number;
  max_level: number;
  rate: number | null;
}

/** Condition values (time, season, swarm…) referenced by grouped rows, by id. */
async function conditionNames(
  db: AnySQLiteDatabase,
  rows: readonly Pick<GroupRow, 'conditions'>[],
  langChain: readonly string[],
): Promise<Map<number, NamedEntity>> {
  const ids = [
    ...new Set(rows.flatMap((row) => (row.conditions ? row.conditions.split(',') : []))),
  ].map(Number);
  const names = new Map<number, NamedEntity>();
  if (ids.length === 0) return names;
  const conditionRows = (await db.all(sql`
    SELECT cv.id, cv.identifier,
      ${pickI18n('encounter_condition_value_i18n', 'condition_value_id', sql`cv.id`, 'name', langChain)} AS name
    FROM encounter_condition_values cv WHERE cv.id IN (${sqlList(ids)})`)) as {
    id: number;
    identifier: string;
    name: string | null;
  }[];
  for (const row of conditionRows) {
    names.set(row.id, { id: row.id, identifier: row.identifier, name: row.name ?? row.identifier });
  }
  return names;
}

/**
 * Collapses rows that differ only by version (Red and Blue share most encounters) into one
 * entry listing the versions. `key` identifies everything else that must match.
 */
function mergeVersions<R extends GroupRow, E extends { versions: readonly NamedEntity[] }>(
  rows: readonly R[],
  key: (row: R) => string,
  build: (row: R, versions: NamedEntity[]) => E,
): E[] {
  const merged = new Map<string, { entry: E; versions: NamedEntity[] }>();
  for (const row of rows) {
    const id = [
      key(row),
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
    const existing = merged.get(id);
    if (existing) {
      existing.versions.push(version);
      continue;
    }
    const versions = [version];
    merged.set(id, { versions, entry: build(row, versions) });
  }
  return [...merged.values()].map(({ entry }) => entry);
}

function namedConditions(row: GroupRow, names: Map<number, NamedEntity>): NamedEntity[] {
  return (row.conditions ? row.conditions.split(',') : [])
    .map((id) => names.get(Number(id)))
    .filter((condition): condition is NamedEntity => condition !== undefined);
}

/** Sorted condition value ids of the encounter aliased `e`, as `1,5` (null = always). */
const CONDITIONS = sql`(SELECT group_concat(id, ',') FROM (
  SELECT condition_value_id AS id FROM encounter_condition_value_map
  WHERE encounter_id = e.id ORDER BY condition_value_id))`;

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
      em.id AS method_id, em.identifier AS method_identifier,
      ${pickI18n('encounter_method_i18n', 'method_id', sql`em.id`, 'name', langChain)} AS method_name,
      g.conditions, g.min_level, g.max_level, g.rate
    FROM (
      SELECT e.version_id, e.location_area_id, e.method_id, ${CONDITIONS} AS conditions,
        min(e.min_level) AS min_level, max(e.max_level) AS max_level, sum(e.rate_pct) AS rate
      FROM encounters e
      WHERE e.pokemon_id = ${pokemonId} AND e.version_id IN (${sqlList(ctx.versionIds)})
      GROUP BY e.version_id, e.location_area_id, e.method_id, conditions
    ) g
    JOIN versions v ON v.id = g.version_id
    JOIN location_areas la ON la.id = g.location_area_id
    JOIN locations l ON l.id = la.location_id
    JOIN encounter_methods em ON em.id = g.method_id
    ORDER BY location_name, la.id, em.sort_order, g.conditions, g.version_id`)) as (GroupRow & {
    location_id: number;
    location_identifier: string;
    location_name: string | null;
  })[];
  if (rows.length === 0) return [];
  const names = await conditionNames(db, rows, langChain);
  return mergeVersions(
    rows,
    () => '',
    (row, versions) => ({
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
      conditions: namedConditions(row, names),
      versions,
    }),
  );
}

/** One Pokémon of a location area (RF06.2). */
export interface AreaEncounter {
  readonly pokemon: {
    readonly id: number;
    readonly speciesId: number;
    readonly name: string;
    /** Type identifiers as of the context generation. */
    readonly types: readonly string[];
  };
  readonly method: NamedEntity;
  readonly minLevel: number;
  readonly maxLevel: number;
  readonly ratePct: number | null;
  /** Time of day, season, swarm, radio… (empty = always). */
  readonly conditions: readonly NamedEntity[];
  readonly versions: readonly NamedEntity[];
}

export interface LocationAreaEncounters {
  readonly areaId: number;
  /** Area name (null for a location's single unnamed area). */
  readonly areaName: string | null;
  readonly encounters: readonly AreaEncounter[];
}

/**
 * RF06.2: every wild Pokémon of a location in the context game's versions, per area, with
 * method, levels, summed rate and conditions (time of day, season…). Areas without
 * encounters in the game are omitted.
 */
export async function getLocationEncounters(
  db: AnySQLiteDatabase,
  locationId: number,
  ctx: GameContext,
): Promise<LocationAreaEncounters[]> {
  if (ctx.versionIds.length === 0) return [];
  const { langChain, generationId } = ctx;
  const rows = (await db.all(sql`
    SELECT g.version_id, v.identifier AS version_identifier,
      ${pickI18n('version_i18n', 'version_id', sql`v.id`, 'name', langChain)} AS version_name,
      g.location_area_id,
      ${pickI18n('location_area_i18n', 'location_area_id', sql`g.location_area_id`, 'name', langChain)} AS area_name,
      em.id AS method_id, em.identifier AS method_identifier,
      ${pickI18n('encounter_method_i18n', 'method_id', sql`em.id`, 'name', langChain)} AS method_name,
      g.conditions, g.min_level, g.max_level, g.rate,
      p.id AS pokemon_id, p.species_id, ${pokemonName(sql`p.id`, langChain)} AS pokemon_name,
      (SELECT group_concat(identifier, ',') FROM (
         SELECT t.identifier FROM pokemon_types_by_gen pt JOIN types t ON t.id = pt.type_id
         WHERE pt.pokemon_id = p.id AND pt.generation_id = ${generationId} ORDER BY pt.slot)) AS types
    FROM (
      SELECT e.version_id, e.location_area_id, e.method_id, e.pokemon_id, ${CONDITIONS} AS conditions,
        min(e.min_level) AS min_level, max(e.max_level) AS max_level, sum(e.rate_pct) AS rate
      FROM location_areas la
      JOIN encounters e ON e.location_area_id = la.id
      WHERE la.location_id = ${locationId} AND e.version_id IN (${sqlList(ctx.versionIds)})
      GROUP BY e.version_id, e.location_area_id, e.method_id, e.pokemon_id, conditions
    ) g
    JOIN versions v ON v.id = g.version_id
    JOIN encounter_methods em ON em.id = g.method_id
    JOIN pokemon p ON p.id = g.pokemon_id
    ORDER BY g.location_area_id, em.sort_order, g.conditions, g.rate DESC, p.species_id,
      g.min_level, g.version_id`)) as (GroupRow & {
    pokemon_id: number;
    species_id: number;
    pokemon_name: string;
    types: string | null;
  })[];
  if (rows.length === 0) return [];
  const names = await conditionNames(db, rows, langChain);
  const encounters = mergeVersions(
    rows,
    (row) => String(row.pokemon_id),
    (row, versions) => ({
      areaId: row.location_area_id,
      areaName: row.area_name || null,
      encounter: {
        pokemon: {
          id: row.pokemon_id,
          speciesId: row.species_id,
          name: row.pokemon_name,
          types: row.types ? row.types.split(',') : [],
        },
        method: {
          id: row.method_id,
          identifier: row.method_identifier,
          name: row.method_name ?? row.method_identifier,
        },
        minLevel: row.min_level,
        maxLevel: row.max_level,
        ratePct: row.rate,
        conditions: namedConditions(row, names),
        versions,
      } satisfies AreaEncounter,
      versions,
    }),
  );
  const areas = new Map<number, { areaName: string | null; encounters: AreaEncounter[] }>();
  for (const { areaId, areaName, encounter } of encounters) {
    const area = areas.get(areaId) ?? { areaName, encounters: [] };
    area.encounters.push(encounter);
    areas.set(areaId, area);
  }
  return [...areas].map(([areaId, area]) => ({ areaId, ...area }));
}
