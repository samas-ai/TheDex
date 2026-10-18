import { sql } from 'drizzle-orm';
import type { AnySQLiteDatabase } from '../types';

/** All `meta` rows of the game database (schema_version, data_version, sources…). */
export async function getDataMeta(db: AnySQLiteDatabase): Promise<Record<string, string>> {
  const rows = (await db.all(sql`SELECT key, value FROM meta`)) as { key: string; value: string }[];
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

/** Row counts of the given tables (diagnostics screen / validation). */
export async function getTableCounts(
  db: AnySQLiteDatabase,
  tables: readonly string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const row = (await db.get(sql`SELECT count(*) AS n FROM ${sql.identifier(table)}`)) as {
      n: number;
    };
    counts[table] = row.n;
  }
  return counts;
}
