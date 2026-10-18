import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

/**
 * Any Drizzle SQLite database: better-sqlite3 (Node, tests, pipeline) or expo-sqlite (app).
 * Repositories only use `db.all` / `db.get` with raw SQL, so the schema type is irrelevant.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySQLiteDatabase = BaseSQLiteDatabase<'sync' | 'async', any, any>;

/**
 * Explicit game context passed to every game-data query (never a hidden global).
 * `langChain` is ordered by preference and should end with `'en'`.
 */
export interface GameContext {
  readonly gameId: number;
  readonly gameIdentifier: string;
  readonly generationId: number;
  /** Base version group first, then DLC version groups. */
  readonly versionGroupIds: readonly number[];
  readonly langChain: readonly string[];
}

/** Language codes whose names are typically 1-3 characters and need substring search. */
export const CJK_LANGS: ReadonlySet<string> = new Set([
  'ja',
  'ja-Hrkt',
  'ko',
  'zh-Hans',
  'zh-Hant',
]);
