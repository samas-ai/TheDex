import { sql, type SQL } from 'drizzle-orm';
import { pickI18n, sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';
import type { NamedEntity } from './catalog';

/**
 * Location Dex groups (RF06.1), in display order (locations.location_kind, derived by the
 * pipeline). `cave` includes mountains and other dungeons.
 */
export const LOCATION_KINDS = ['city', 'route', 'cave', 'water', 'building', 'area'] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

const kindOf = (kind: string | null): LocationKind =>
  (LOCATION_KINDS as readonly string[]).includes(kind ?? '') ? (kind as LocationKind) : 'area';

/** Natural order of names ("Route 2" before "Route 10"). */
export function compareNatural(a: string, b: string): number {
  const chunks = (text: string) => text.toLocaleLowerCase().match(/\d+|\D+/g) ?? [];
  const left = chunks(a);
  const right = chunks(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const x = left[i]!;
    const y = right[i]!;
    if (x === y) continue;
    const numeric = /^\d/.test(x) && /^\d/.test(y);
    if (numeric) return Number(x) - Number(y) || x.length - y.length;
    return x < y ? -1 : 1;
  }
  return left.length - right.length;
}

/** Regions of the context game's version groups (alias `l` = locations). */
function inGameRegion(ctx: GameContext, regionColumn: SQL): SQL {
  return sql`${regionColumn} IN (SELECT region_id FROM version_group_regions
    WHERE version_group_id IN (${sqlList(ctx.versionGroupIds)}))`;
}

/** Locations with wild encounters in the context game's versions (alias `l`). */
function hasEncounters(ctx: GameContext): SQL {
  if (ctx.versionIds.length === 0) return sql`0`;
  return sql`EXISTS (SELECT 1 FROM location_areas la
    JOIN encounters e ON e.location_area_id = la.id AND e.version_id IN (${sqlList(ctx.versionIds)})
    WHERE la.location_id = l.id)`;
}

/**
 * Whether a location belongs to the context game: one of its regions and present in its
 * generation's games (PokeAPI location_game_indices), or it has encounters in the game.
 */
function inGame(ctx: GameContext): SQL {
  return sql`((${inGameRegion(ctx, sql`l.region_id`)} AND EXISTS (SELECT 1 FROM location_generations lg
      WHERE lg.location_id = l.id AND lg.generation_id = ${ctx.generationId}))
    OR ${hasEncounters(ctx)})`;
}

export interface LocationRegion extends NamedEntity {
  /** A region of the context game (its locations are listed by default). */
  readonly inGame: boolean;
}

/** Regions with locations (RF06.1), Kanto to Paldea, flagging the context game's. */
export async function listLocationRegions(
  db: AnySQLiteDatabase,
  ctx: GameContext,
): Promise<LocationRegion[]> {
  const rows = (await db.all(sql`
    SELECT r.id, r.identifier,
      COALESCE(${pickI18n('region_i18n', 'region_id', sql`r.id`, 'name', ctx.langChain)}, r.identifier) AS name,
      ${inGameRegion(ctx, sql`r.id`)} AS in_game
    FROM regions r
    WHERE EXISTS (SELECT 1 FROM locations l WHERE l.region_id = r.id)
    ORDER BY r.id`)) as { id: number; identifier: string; name: string; in_game: number }[];
  return rows.map((row) => ({
    id: row.id,
    identifier: row.identifier,
    name: row.name,
    inGame: row.in_game === 1,
  }));
}

export interface LocationListEntry extends NamedEntity {
  readonly kind: LocationKind;
  readonly regionId: number | null;
  /** Part of the context game (see `inGame` above). */
  readonly inGame: boolean;
  /** Has wild encounters in the context game's versions. */
  readonly hasEncounters: boolean;
}

/** Location Dex (RF06.1): a region's locations by group, in natural name order. */
export async function listLocations(
  db: AnySQLiteDatabase,
  ctx: GameContext,
  query: { readonly regionId: number; readonly inGameOnly?: boolean },
): Promise<LocationListEntry[]> {
  const rows = (await db.all(sql`
    SELECT id, identifier, name, location_kind, region_id, in_game, has_encounters FROM (
      SELECT l.id, l.identifier, l.location_kind, l.region_id,
        COALESCE(${pickI18n('location_i18n', 'location_id', sql`l.id`, 'name', ctx.langChain)}, l.identifier) AS name,
        ${inGame(ctx)} AS in_game, ${hasEncounters(ctx)} AS has_encounters
      FROM locations l WHERE l.region_id = ${query.regionId}
    ) ${query.inGameOnly ? sql`WHERE in_game = 1` : sql``}`)) as {
    id: number;
    identifier: string;
    name: string;
    location_kind: string | null;
    region_id: number | null;
    in_game: number;
    has_encounters: number;
  }[];
  const order = (kind: LocationKind) => LOCATION_KINDS.indexOf(kind);
  return rows
    .map((row) => ({
      id: row.id,
      identifier: row.identifier,
      name: row.name,
      kind: kindOf(row.location_kind),
      regionId: row.region_id,
      inGame: row.in_game === 1,
      hasEncounters: row.has_encounters === 1,
    }))
    .sort((a, b) => order(a.kind) - order(b.kind) || compareNatural(a.name, b.name) || a.id - b.id);
}

export interface LocationDetail extends NamedEntity {
  /** e.g. "Lake Verity" subtitle of some Gen 4+ names. */
  readonly subtitle: string | null;
  readonly kind: LocationKind;
  readonly region: NamedEntity | null;
  readonly inGame: boolean;
  readonly hasEncounters: boolean;
}

export async function getLocation(
  db: AnySQLiteDatabase,
  locationId: number,
  ctx: GameContext,
): Promise<LocationDetail | null> {
  const { langChain } = ctx;
  const row = (await db.get(sql`
    SELECT l.id, l.identifier, l.location_kind,
      COALESCE(${pickI18n('location_i18n', 'location_id', sql`l.id`, 'name', langChain)}, l.identifier) AS name,
      ${pickI18n('location_i18n', 'location_id', sql`l.id`, 'subtitle', langChain)} AS subtitle,
      r.id AS region_id, r.identifier AS region,
      ${pickI18n('region_i18n', 'region_id', sql`r.id`, 'name', langChain)} AS region_name,
      ${inGame(ctx)} AS in_game, ${hasEncounters(ctx)} AS has_encounters
    FROM locations l LEFT JOIN regions r ON r.id = l.region_id
    WHERE l.id = ${locationId}`)) as
    | {
        id: number;
        identifier: string;
        location_kind: string | null;
        name: string;
        subtitle: string | null;
        region_id: number | null;
        region: string | null;
        region_name: string | null;
        in_game: number;
        has_encounters: number;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    identifier: row.identifier,
    name: row.name,
    subtitle: row.subtitle,
    kind: kindOf(row.location_kind),
    region:
      row.region_id === null || row.region === null
        ? null
        : { id: row.region_id, identifier: row.region, name: row.region_name ?? row.region },
    inGame: row.in_game === 1,
    hasEncounters: row.has_encounters === 1,
  };
}
