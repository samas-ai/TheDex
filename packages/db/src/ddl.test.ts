import Database from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { gameSchemaDdl } from './ddl';
import { gameTables, WITHOUT_ROWID_TABLES } from './schema/game/index';

function createGameDb(): Database.Database {
  const db = new Database(':memory:');
  for (const statement of gameSchemaDdl()) db.exec(statement);
  return db;
}

describe('game schema DDL', () => {
  it('creates every table and index without errors', () => {
    const db = createGameDb();
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .pluck()
      .all() as string[];
    expect(tables.sort()).toEqual(gameTables.map((t) => getTableConfig(t).name).sort());
  });

  it('marks exactly the configured tables WITHOUT ROWID', () => {
    const db = createGameDb();
    const names = new Set(gameTables.map((t) => getTableConfig(t).name));
    for (const name of WITHOUT_ROWID_TABLES) expect(names.has(name), name).toBe(true);

    const rows = db.prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'table'`).all() as {
      name: string;
      sql: string;
    }[];
    for (const row of rows) {
      expect(row.sql.endsWith('WITHOUT ROWID'), row.name).toBe(WITHOUT_ROWID_TABLES.has(row.name));
    }
  });

  it('declares foreign keys that resolve to existing tables', () => {
    const db = createGameDb();
    const fkTargets = gameTables.flatMap((t) =>
      getTableConfig(t).foreignKeys.map((fk) => getTableConfig(fk.reference().foreignTable).name),
    );
    const tables = new Set(
      db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).pluck().all() as string[],
    );
    for (const target of fkTargets) expect(tables.has(target), target).toBe(true);
    db.pragma('foreign_keys = ON');
    expect(db.pragma('foreign_key_check')).toEqual([]);
  });
});
