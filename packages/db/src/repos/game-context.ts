import { sql } from 'drizzle-orm';
import { pickI18n, sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';

interface GameRow {
  id: number;
  identifier: string;
  generation_id: number;
}

/** Builds the `GameContext` for a curated game (by id or identifier). */
export async function resolveGameContext(
  db: AnySQLiteDatabase,
  game: number | string,
  langChain: readonly string[],
): Promise<GameContext> {
  const where = typeof game === 'number' ? sql`id = ${game}` : sql`identifier = ${game}`;
  const row = (await db.get(
    sql`SELECT id, identifier, generation_id FROM games WHERE ${where}`,
  )) as GameRow | undefined;
  if (!row) throw new Error(`Unknown game: ${game}`);

  const versionGroups = (await db.all(sql`
    SELECT version_group_id FROM game_version_groups
    WHERE game_id = ${row.id} ORDER BY is_base DESC, sort_order`)) as {
    version_group_id: number;
  }[];

  const versions = (await db.all(sql`
    SELECT version_id FROM game_versions WHERE game_id = ${row.id} ORDER BY version_id`)) as {
    version_id: number;
  }[];

  const chain = langChain.includes('en') ? langChain : [...langChain, 'en'];
  return {
    gameId: row.id,
    gameIdentifier: row.identifier,
    generationId: row.generation_id,
    versionGroupIds: versionGroups.map((vg) => vg.version_group_id),
    versionIds: versions.map((version) => version.version_id),
    langChain: chain,
  };
}

export interface GameSummary {
  readonly id: number;
  readonly identifier: string;
  readonly generationId: number;
  readonly name: string;
}

/** Curated games in display order (for the global selector, RF01.2). */
export async function listGames(
  db: AnySQLiteDatabase,
  langChain: readonly string[],
): Promise<GameSummary[]> {
  const rows = (await db.all(sql`
    SELECT g.id, g.identifier, g.generation_id,
      ${pickI18n('game_i18n', 'game_id', sql`g.id`, 'name', langChain)} AS name
    FROM games g ORDER BY g.sort_order`)) as {
    id: number;
    identifier: string;
    generation_id: number;
    name: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    identifier: row.identifier,
    generationId: row.generation_id,
    name: row.name ?? row.identifier,
  }));
}

/** What PokeAPI has for a game and which battle mechanics it uses. */
export interface GameFeatures {
  /** Learnsets exist (PokeAPI lacks Legends: Z-A and the DLC learnsets). */
  readonly hasLearnsets: boolean;
  /** Wild encounters exist (PokeAPI lacks SV, Legends: Arceus, BDSP, Z-A…). */
  readonly hasEncounters: boolean;
  readonly hasMega: boolean;
  readonly hasZ: boolean;
  readonly hasDynamax: boolean;
  readonly hasTera: boolean;
}

/**
 * Data coverage and mechanics of the context game, so screens can tell "none" from "PokeAPI
 * has no data for this game". Both EXISTS probes walk small tables into an index.
 */
export async function getGameFeatures(
  db: AnySQLiteDatabase,
  ctx: GameContext,
): Promise<GameFeatures> {
  const versions = ctx.versionIds.length > 0 ? sqlList(ctx.versionIds) : sql`NULL`;
  const row = (await db.get(sql`
    SELECT g.has_mega, g.has_z, g.has_dynamax, g.has_tera,
      EXISTS (SELECT 1 FROM moves m WHERE EXISTS (SELECT 1 FROM pokemon_moves pm
        WHERE pm.move_id = m.id AND pm.version_group_id IN (${sqlList(ctx.versionGroupIds)}))) AS has_learnsets,
      EXISTS (SELECT 1 FROM location_areas la WHERE EXISTS (SELECT 1 FROM encounters e
        WHERE e.location_area_id = la.id AND e.version_id IN (${versions}))) AS has_encounters
    FROM games g WHERE g.id = ${ctx.gameId}`)) as
    | {
        has_mega: number;
        has_z: number;
        has_dynamax: number;
        has_tera: number;
        has_learnsets: number;
        has_encounters: number;
      }
    | undefined;
  if (!row) throw new Error(`Unknown game: ${ctx.gameId}`);
  return {
    hasLearnsets: row.has_learnsets === 1,
    hasEncounters: row.has_encounters === 1,
    hasMega: row.has_mega === 1,
    hasZ: row.has_z === 1,
    hasDynamax: row.has_dynamax === 1,
    hasTera: row.has_tera === 1,
  };
}
