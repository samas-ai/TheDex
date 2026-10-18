import { sql } from 'drizzle-orm';
import { pickI18n } from '../sql';
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
