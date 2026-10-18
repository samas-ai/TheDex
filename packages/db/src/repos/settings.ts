import { sql } from 'drizzle-orm';
import type { AnySQLiteDatabase } from '../types';

/** Keys stored in thedex-user.db `settings` (values are JSON). */
export const SETTING_KEYS = ['ui_lang', 'game_langs', 'theme', 'sprite_style', 'game_id'] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

/**
 * Raw settings as parsed JSON, keyed by setting key. Rows with invalid JSON are skipped;
 * typing/validation with defaults is the app's job (values may come from older versions).
 */
export async function readSettings(db: AnySQLiteDatabase): Promise<Record<string, unknown>> {
  const rows = (await db.all(sql`SELECT key, value_json FROM settings`)) as {
    key: string;
    value_json: string;
  }[];
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value_json) as unknown;
    } catch {
      // Corrupt value: ignore it so the caller falls back to the default.
    }
  }
  return result;
}

/** Upserts one setting. `updatedAt` (epoch ms) drives last-write-wins sync merges. */
export async function writeSetting(
  db: AnySQLiteDatabase,
  key: string,
  value: unknown,
  updatedAt: number,
): Promise<void> {
  await db.run(sql`
    INSERT INTO settings (key, value_json, updated_at) VALUES (${key}, ${JSON.stringify(value)}, ${updatedAt})
    ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`);
}
