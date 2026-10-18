import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generations } from './core';
import { nameTable } from './helpers';
import { moveDamageClasses } from './moves';
import { pokemon } from './pokemon';

/** Types. Effectiveness is NOT stored here — `@thedex/engine` is the source of truth. */
export const types = sqliteTable('types', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
  generationId: integer('generation_id')
    .notNull()
    .references(() => generations.id),
  /** Pre-Gen 4 damage class implied by the type (null for status-only/special types). */
  legacyDamageClassId: integer('legacy_damage_class_id').references(() => moveDamageClasses.id),
});
export const typeI18n = nameTable('type_i18n', 'type_id', () => types.id);

export const stats = sqliteTable('stats', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
  damageClassId: integer('damage_class_id').references(() => moveDamageClasses.id),
  isBattleOnly: integer('is_battle_only', { mode: 'boolean' }).notNull(),
  gameIndex: integer('game_index'),
});
export const statI18n = nameTable('stat_i18n', 'stat_id', () => stats.id);

/** Berry flavors (PokeAPI contest types): spicy, dry, sweet, bitter, sour. */
export const flavors = sqliteTable('flavors', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
});
export const flavorI18n = nameTable('flavor_i18n', 'flavor_id', () => flavors.id);

export const natures = sqliteTable('natures', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
  psId: text('ps_id'),
  increasedStatId: integer('increased_stat_id')
    .notNull()
    .references(() => stats.id),
  decreasedStatId: integer('decreased_stat_id')
    .notNull()
    .references(() => stats.id),
  likesFlavorId: integer('likes_flavor_id')
    .notNull()
    .references(() => flavors.id),
  hatesFlavorId: integer('hates_flavor_id')
    .notNull()
    .references(() => flavors.id),
  gameIndex: integer('game_index').notNull(),
});
export const natureI18n = nameTable('nature_i18n', 'nature_id', () => natures.id);

/**
 * Where each media style/variant is downloaded from: an immutable URL prefix pinned to a
 * PokeAPI/sprites or PokeAPI/cries commit (data/curated is not involved; see config.ts).
 */
export const mediaSources = sqliteTable(
  'media_sources',
  {
    /** official | pixel | 3d | home | cry */
    style: text('style').notNull(),
    /** default | shiny (sprites), latest | legacy (cries) */
    variant: text('variant').notNull(),
    /** URL prefix; an asset URL is `${base_url}/${media_assets.path}`. */
    baseUrl: text('base_url').notNull(),
    /** File format: png | gif | ogg (| m4a for the planned iOS cry pack). */
    format: text('format').notNull(),
  },
  (t) => [primaryKey({ columns: [t.style, t.variant] })],
);

/** Downloadable media manifest: which files exist at the pinned commits, and their size. */
export const mediaAssets = sqliteTable(
  'media_assets',
  {
    pokemonId: integer('pokemon_id')
      .notNull()
      .references(() => pokemon.id),
    /** official | pixel | 3d | home | cry */
    style: text('style').notNull(),
    /** default | shiny | latest | legacy */
    variant: text('variant').notNull(),
    /** File name relative to the source's base_url (e.g. `25.png`). */
    path: text('path').notNull(),
    bytes: integer('bytes'),
  },
  (t) => [primaryKey({ columns: [t.pokemonId, t.style, t.variant] })],
);
