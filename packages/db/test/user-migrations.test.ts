import Database from 'better-sqlite3';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { describe, expect, it } from 'vitest';
import * as userSchema from '../src/schema/user/index';
import { userMigrations } from '../src/schema/user/migrations.generated';

const migrationsFolder = path.resolve(
  fileURLToPath(new URL('../migrations/user', import.meta.url)),
);

function createUserDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema: userSchema });
  migrate(db, { migrationsFolder });
  return { sqlite, db };
}

describe('thedex-user.db migrations', () => {
  it('creates every user table', () => {
    const { sqlite } = createUserDb();
    const tables = sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_\\_%' ESCAPE '\\'`,
      )
      .pluck()
      .all();
    expect(new Set(tables)).toEqual(
      new Set(['settings', 'favorites', 'teams', 'checklist_entries', 'media_cache', 'sync_state']),
    );
  });

  it('keys the checklist by (dex_scope, pokemon_id, form_id) with form 0 as default', () => {
    const { db } = createUserDb();
    db.insert(userSchema.checklistEntries)
      .values({ dexScope: 'national', pokemonId: 201, caught: true })
      .run();
    // Unown "B" (another form of the same pokemon_id) is a separate entry.
    db.insert(userSchema.checklistEntries)
      .values({ dexScope: 'national', pokemonId: 201, formId: 10001, seen: true })
      .run();
    const rows = db.select().from(userSchema.checklistEntries).all();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.formId === 0)?.caught).toBe(true);
    expect(rows[0]?.updatedAt).toBeGreaterThan(1_600_000_000_000);
    expect(() =>
      db.insert(userSchema.checklistEntries).values({ dexScope: 'national', pokemonId: 201 }).run(),
    ).toThrow(/UNIQUE|PRIMARY KEY/);
  });

  it('uses natural keys for favorites so re-favoriting is an upsert', () => {
    const { db } = createUserDb();
    const row = { entityType: 'pokemon', entityId: 25, createdAt: 1 };
    db.insert(userSchema.favorites).values(row).run();
    db.insert(userSchema.favorites)
      .values({ ...row, deletedAt: null })
      .onConflictDoUpdate({
        target: [userSchema.favorites.entityType, userSchema.favorites.entityId],
        set: { deletedAt: null },
      })
      .run();
    expect(db.select().from(userSchema.favorites).all()).toHaveLength(1);
  });

  it('keeps the generated bundle in sync with the migration folder', async () => {
    const journal = JSON.parse(
      await readFile(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8'),
    ) as { entries: { tag: string }[] };
    expect(userMigrations.journal.entries).toHaveLength(journal.entries.length);
    const first = journal.entries[0];
    expect(first).toBeDefined();
    const sql = await readFile(path.join(migrationsFolder, `${first!.tag}.sql`), 'utf8');
    expect(userMigrations.migrations.m0000).toBe(sql.replaceAll('\r\n', '\n'));
  });
});
