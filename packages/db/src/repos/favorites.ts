import { sql } from 'drizzle-orm';
import type { AnySQLiteDatabase } from '../types';
import { compareNatural } from './locations';
import { getEntityNames } from './team-data';

/** What can be favorited (`favorites.entity_type`), in the order the favorites screen lists them. */
export const FAVORITE_ENTITY_TYPES = ['pokemon', 'move', 'ability', 'item', 'location'] as const;
export type FavoriteEntityType = (typeof FAVORITE_ENTITY_TYPES)[number];

export function isFavoriteEntityType(value: string): value is FavoriteEntityType {
  return (FAVORITE_ENTITY_TYPES as readonly string[]).includes(value);
}

export interface Favorite {
  readonly entityType: FavoriteEntityType;
  /** PokeAPI id: `pokemon.id` (the variety), `moves.id`, `abilities.id`, `items.id`, `locations.id`. */
  readonly entityId: number;
  /** When it was (last) favorited. */
  readonly createdAt: number;
}

interface FavoriteRow {
  entity_type: string;
  entity_id: number;
  created_at: number;
}

/**
 * Live favorites, most recent first, of one entity type or of every type. Rows of types this
 * app version does not know (a newer backup or sync) are skipped.
 */
export async function listFavorites(
  db: AnySQLiteDatabase,
  entityType?: FavoriteEntityType,
): Promise<Favorite[]> {
  const byType = entityType === undefined ? sql`` : sql` AND entity_type = ${entityType}`;
  const rows = (await db.all(sql`
    SELECT entity_type, entity_id, created_at FROM favorites
    WHERE deleted_at IS NULL${byType}
    ORDER BY created_at DESC, entity_type, entity_id`)) as FavoriteRow[];
  return rows.flatMap((row) =>
    isFavoriteEntityType(row.entity_type)
      ? [{ entityType: row.entity_type, entityId: row.entity_id, createdAt: row.created_at }]
      : [],
  );
}

export async function isFavorite(
  db: AnySQLiteDatabase,
  entityType: FavoriteEntityType,
  entityId: number,
): Promise<boolean> {
  const row = await db.get(sql`
    SELECT 1 AS found FROM favorites
    WHERE entity_type = ${entityType} AND entity_id = ${entityId} AND deleted_at IS NULL`);
  // No row: undefined in better-sqlite3, null in expo-sqlite.
  return row != null;
}

/**
 * Favorites or unfavorites an entity, stamping `updated_at` so sync merges it last-write-wins
 * (RNF06). Removing keeps the row as a tombstone, like `deleteTeam`, so the removal syncs too;
 * favoriting again revives it with a new `created_at`. Repeating the current state is a no-op.
 */
export async function setFavorite(
  db: AnySQLiteDatabase,
  entityType: FavoriteEntityType,
  entityId: number,
  favorite: boolean,
  now: number,
): Promise<void> {
  if (favorite) {
    await db.run(sql`
      INSERT INTO favorites (entity_type, entity_id, created_at, updated_at, deleted_at)
      VALUES (${entityType}, ${entityId}, ${now}, ${now}, NULL)
      ON CONFLICT (entity_type, entity_id) DO UPDATE SET created_at = excluded.created_at,
        updated_at = excluded.updated_at, deleted_at = NULL
      WHERE favorites.deleted_at IS NOT NULL`);
  } else {
    await db.run(sql`
      UPDATE favorites SET deleted_at = ${now}, updated_at = ${now}
      WHERE entity_type = ${entityType} AND entity_id = ${entityId} AND deleted_at IS NULL`);
  }
}

/** Flips an entity's favorite state and returns the new one. */
export async function toggleFavorite(
  db: AnySQLiteDatabase,
  entityType: FavoriteEntityType,
  entityId: number,
  now: number,
): Promise<boolean> {
  const favorite = !(await isFavorite(db, entityType, entityId));
  await setFavorite(db, entityType, entityId, favorite, now);
  return favorite;
}

/** A favorite with its name in the context languages (favorites screen). */
export interface FavoriteEntry extends Favorite {
  readonly name: string;
}

/**
 * Every live favorite with its name, grouped in FAVORITE_ENTITY_TYPES order and sorted by name
 * within a type. Needs the game DB attached; favorites whose entity is not in it are skipped.
 */
export async function listFavoriteEntries(
  db: AnySQLiteDatabase,
  langChain: readonly string[],
): Promise<FavoriteEntry[]> {
  const favorites = await listFavorites(db);
  const entries: FavoriteEntry[] = [];
  for (const entityType of FAVORITE_ENTITY_TYPES) {
    const ofType = favorites.filter((favorite) => favorite.entityType === entityType);
    if (ofType.length === 0) continue;
    const names = await getEntityNames(
      db,
      langChain,
      entityType,
      ofType.map((favorite) => favorite.entityId),
    );
    entries.push(
      ...ofType
        .flatMap((favorite) => {
          const name = names.get(favorite.entityId);
          return name === undefined ? [] : [{ ...favorite, name }];
        })
        .sort((a, b) => compareNatural(a.name, b.name) || a.entityId - b.entityId),
    );
  }
  return entries;
}
