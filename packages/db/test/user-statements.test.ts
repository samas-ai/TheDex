import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readSettings, writeSetting } from '../src/repos/settings';
import { userSchemaStatements } from '../src/schema/user/statements';

function userDb() {
  const sqlite = new Database(':memory:');
  for (const statement of userSchemaStatements()) sqlite.exec(statement);
  return { sqlite, db: drizzle(sqlite) };
}

describe('userSchemaStatements', () => {
  it('recreates the migrated user schema without the migrator', () => {
    const { sqlite } = userDb();
    const tables = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .pluck()
      .all();
    expect(tables).toEqual([
      'checklist_entries',
      'favorites',
      'media_cache',
      'settings',
      'sync_state',
      'teams',
    ]);
  });
});

describe('settings repository', () => {
  it('upserts JSON values with their timestamp and skips corrupt rows', async () => {
    const { sqlite, db } = userDb();
    await writeSetting(db, 'theme', 'dark', 1);
    await writeSetting(db, 'theme', 'amoled', 2);
    await writeSetting(db, 'game_langs', ['pt-BR', 'en'], 3);
    sqlite.prepare(`INSERT INTO settings (key, value_json) VALUES ('broken', '{')`).run();
    expect(await readSettings(db)).toEqual({ theme: 'amoled', game_langs: ['pt-BR', 'en'] });
    expect(
      sqlite.prepare(`SELECT updated_at FROM settings WHERE key = 'theme'`).pluck().get(),
    ).toBe(2);
  });
});
