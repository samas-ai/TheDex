import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import { userSchemaStatements } from '../schema/user/statements';
import type { AnySQLiteDatabase } from '../types';
import { exportBackup } from './backup';
import {
  isFavorite,
  isFavoriteEntityType,
  listFavorites,
  setFavorite,
  toggleFavorite,
} from './favorites';

function userDb() {
  const sqlite = new Database(':memory:');
  for (const statement of userSchemaStatements()) sqlite.exec(statement);
  return { sqlite, db: drizzle(sqlite) };
}

const rowOf = (sqlite: Database.Database, entityType: string, entityId: number) =>
  sqlite
    .prepare(
      `SELECT created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt
       FROM favorites WHERE entity_type = ? AND entity_id = ?`,
    )
    .get(entityType, entityId);

describe('favorites', () => {
  it('knows the entity types', () => {
    expect(isFavoriteEntityType('pokemon')).toBe(true);
    expect(isFavoriteEntityType('location')).toBe(true);
    expect(isFavoriteEntityType('nature')).toBe(false);
  });

  it('lists live favorites, most recent first, by type or all', async () => {
    const { db } = userDb();
    await setFavorite(db, 'pokemon', 25, true, 10);
    await setFavorite(db, 'move', 85, true, 20);
    await setFavorite(db, 'pokemon', 6, true, 30);
    await setFavorite(db, 'pokemon', 4, true, 40);
    await setFavorite(db, 'pokemon', 4, false, 50);

    expect(await listFavorites(db, 'pokemon')).toEqual([
      { entityType: 'pokemon', entityId: 6, createdAt: 30 },
      { entityType: 'pokemon', entityId: 25, createdAt: 10 },
    ]);
    expect((await listFavorites(db)).map((f) => [f.entityType, f.entityId])).toEqual([
      ['pokemon', 6],
      ['move', 85],
      ['pokemon', 25],
    ]);
    expect(await listFavorites(db, 'item')).toEqual([]);
  });

  it('skips entity types this version does not know (newer backups)', async () => {
    const { sqlite, db } = userDb();
    sqlite
      .prepare(
        `INSERT INTO favorites (entity_type, entity_id, created_at, updated_at)
         VALUES ('team-preset', 1, 5, 5)`,
      )
      .run();
    await setFavorite(db, 'item', 17, true, 1);
    expect(await listFavorites(db)).toEqual([{ entityType: 'item', entityId: 17, createdAt: 1 }]);
  });

  it('removes with a tombstone and revives with a new created_at', async () => {
    const { sqlite, db } = userDb();
    await setFavorite(db, 'ability', 65, true, 100);
    expect(await isFavorite(db, 'ability', 65)).toBe(true);
    expect(await isFavorite(db, 'move', 65)).toBe(false);

    await setFavorite(db, 'ability', 65, false, 200);
    expect(await isFavorite(db, 'ability', 65)).toBe(false);
    expect(rowOf(sqlite, 'ability', 65)).toEqual({
      createdAt: 100,
      updatedAt: 200,
      deletedAt: 200,
    });

    await setFavorite(db, 'ability', 65, true, 300);
    expect(await isFavorite(db, 'ability', 65)).toBe(true);
    expect(rowOf(sqlite, 'ability', 65)).toEqual({
      createdAt: 300,
      updatedAt: 300,
      deletedAt: null,
    });
  });

  it('leaves the row untouched when the state does not change', async () => {
    const { sqlite, db } = userDb();
    await setFavorite(db, 'pokemon', 25, true, 100);
    await setFavorite(db, 'pokemon', 25, true, 200);
    expect(rowOf(sqlite, 'pokemon', 25)).toEqual({
      createdAt: 100,
      updatedAt: 100,
      deletedAt: null,
    });

    await setFavorite(db, 'pokemon', 25, false, 300);
    await setFavorite(db, 'pokemon', 25, false, 400);
    expect(rowOf(sqlite, 'pokemon', 25)).toEqual({
      createdAt: 100,
      updatedAt: 300,
      deletedAt: 300,
    });

    // Unfavoriting something never favorited writes nothing.
    await setFavorite(db, 'move', 1, false, 500);
    expect(rowOf(sqlite, 'move', 1)).toBeUndefined();
  });

  it('reads a missing row as null, as expo-sqlite returns it', async () => {
    const expoLike = { get: async () => null } as unknown as AnySQLiteDatabase;
    expect(await isFavorite(expoLike, 'pokemon', 6)).toBe(false);
  });

  it('toggles and returns the new state', async () => {
    const { db } = userDb();
    expect(await toggleFavorite(db, 'location', 155, 1)).toBe(true);
    expect(await isFavorite(db, 'location', 155)).toBe(true);
    expect(await toggleFavorite(db, 'location', 155, 2)).toBe(false);
    expect(await isFavorite(db, 'location', 155)).toBe(false);
  });

  it('exports favorites and their tombstones in the backup', async () => {
    const { db } = userDb();
    await setFavorite(db, 'pokemon', 25, true, 10);
    await setFavorite(db, 'move', 85, true, 20);
    await setFavorite(db, 'move', 85, false, 30);
    const backup = await exportBackup(db, 99);
    expect(backup.data.favorites).toEqual([
      { entityType: 'move', entityId: 85, createdAt: 20, updatedAt: 30, deletedAt: 30 },
      { entityType: 'pokemon', entityId: 25, createdAt: 10, updatedAt: 10, deletedAt: null },
    ]);
  });
});
