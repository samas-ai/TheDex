import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export { userMigrations } from './migrations.generated';

/**
 * thedex-user.db — user data, ready for cloud sync:
 * - natural primary keys where they exist (ULID only for teams);
 * - `updated_at` (epoch ms) + `deleted_at` tombstones for last-write-wins merges;
 * - game references are PokeAPI IDs without physical FKs (the game DB is attached, not owned).
 * Changes here REQUIRE a migration: `pnpm db:generate`.
 */

const updatedAt = () =>
  integer('updated_at')
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);
const deletedAt = () => integer('deleted_at');

/** Key/value settings: ui_lang, game_langs, theme, sprite_style, game_id… */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  updatedAt: updatedAt(),
});

export const favorites = sqliteTable(
  'favorites',
  {
    /** pokemon | move | ability | item | location */
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [primaryKey({ columns: [t.entityType, t.entityId] })],
);

export const teams = sqliteTable(
  'teams',
  {
    /** ULID generated on the device. */
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** Showdown format id (e.g. `gen9ou`) or free text. */
    format: text('format'),
    gameId: integer('game_id'),
    generationId: integer('generation_id').notNull(),
    /** JSON array (≤ 6) of Showdown-compatible PokemonSet objects, validated with Zod. */
    membersJson: text('members_json').notNull(),
    notes: text('notes'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index('teams_sort_idx').on(t.deletedAt, t.sortOrder)],
);

/**
 * Collection tracker (RF09). `form_id = 0` is the default form; otherwise a
 * `pokemon_forms.id`, so cosmetic forms (Unown, Vivillon, Alcremie…) can be tracked
 * individually for a Living Dex.
 */
export const checklistEntries = sqliteTable(
  'checklist_entries',
  {
    /** `national` or `version:<id>`. */
    dexScope: text('dex_scope').notNull(),
    pokemonId: integer('pokemon_id').notNull(),
    formId: integer('form_id').notNull().default(0),
    seen: integer('seen', { mode: 'boolean' }).notNull().default(false),
    caught: integer('caught', { mode: 'boolean' }).notNull().default(false),
    shinyCaught: integer('shiny_caught', { mode: 'boolean' }).notNull().default(false),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [primaryKey({ columns: [t.dexScope, t.pokemonId, t.formId] })],
);

/** Downloaded media (device-local; excluded from backups). */
export const mediaCache = sqliteTable(
  'media_cache',
  {
    key: text('key').primaryKey(),
    kind: text('kind').notNull(),
    url: text('url').notNull(),
    localUri: text('local_uri').notNull(),
    bytes: integer('bytes').notNull(),
    etag: text('etag'),
    fetchedAt: integer('fetched_at').notNull(),
    lastAccessAt: integer('last_access_at').notNull(),
  },
  (t) => [index('media_cache_access_idx').on(t.lastAccessAt)],
);

/** Cloud sync bookkeeping (device-local; excluded from backups). */
export const syncState = sqliteTable('sync_state', {
  provider: text('provider').primaryKey(),
  deviceId: text('device_id').notNull(),
  lastSyncedAt: integer('last_synced_at'),
});

/** Tables included in `.thedex` backups / sync (RNF06). */
export const BACKUP_TABLES = ['settings', 'favorites', 'teams', 'checklist_entries'] as const;
