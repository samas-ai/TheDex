import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { games, generations, languages } from './core';
import { describedNameTable, nameTable, proseTable } from './helpers';
import { locationAreas } from './locations';
import { flavors, types } from './misc';

export const itemPockets = sqliteTable('item_pockets', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
});
export const itemPocketI18n = nameTable('item_pocket_i18n', 'pocket_id', () => itemPockets.id);

export const itemCategories = sqliteTable('item_categories', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
  pocketId: integer('pocket_id')
    .notNull()
    .references(() => itemPockets.id),
});
export const itemCategoryI18n = nameTable(
  'item_category_i18n',
  'category_id',
  () => itemCategories.id,
);

export const itemFlingEffects = sqliteTable('item_fling_effects', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
});
export const itemFlingEffectI18n = sqliteTable(
  'item_fling_effect_i18n',
  {
    flingEffectId: integer('fling_effect_id')
      .notNull()
      .references(() => itemFlingEffects.id),
    lang: text('lang')
      .notNull()
      .references(() => languages.code),
    effect: text('effect').notNull(),
  },
  (t) => [primaryKey({ columns: [t.flingEffectId, t.lang] })],
);

export const itemFlags = sqliteTable('item_flags', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
});
export const itemFlagI18n = describedNameTable('item_flag_i18n', 'flag_id', () => itemFlags.id);

export const items = sqliteTable(
  'items',
  {
    id: integer('id').primaryKey(),
    identifier: text('identifier').notNull(),
    psId: text('ps_id'),
    categoryId: integer('category_id')
      .notNull()
      .references(() => itemCategories.id),
    /**
     * Item Dex group (RF05.1), derived from the category: held | berry | machine | medicine |
     * ball | evolution | treasure | key | other. Filled for every item (data:validate).
     */
    appGroup: text('app_group'),
    /** Buy price; sell price is half (RF05.2). */
    cost: integer('cost'),
    flingPower: integer('fling_power'),
    flingEffectId: integer('fling_effect_id').references(() => itemFlingEffects.id),
  },
  (t) => [index('items_category_idx').on(t.categoryId), index('items_ps_id_idx').on(t.psId)],
);
export const itemI18n = nameTable('item_i18n', 'item_id', () => items.id);

/** Generations whose games have the item (PokeAPI item_game_indices). */
export const itemGenerations = sqliteTable(
  'item_generations',
  {
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    generationId: integer('generation_id')
      .notNull()
      .references(() => generations.id),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.generationId] })],
);

/** Item icon at the pinned sprites commit (`media_sources` style `item`, RF05.2). */
export const itemIcons = sqliteTable('item_icons', {
  itemId: integer('item_id')
    .primaryKey()
    .references(() => items.id),
  /** File name relative to the source's base_url (e.g. `master-ball.png`). */
  path: text('path').notNull(),
  bytes: integer('bytes'),
});
export const itemProseI18n = proseTable('item_prose_i18n', 'item_id', () => items.id);

export const itemFlagMap = sqliteTable(
  'item_flag_map',
  {
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    flagId: integer('flag_id')
      .notNull()
      .references(() => itemFlags.id),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.flagId] })],
);

export const berryFirmness = sqliteTable('berry_firmness', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
});
export const berryFirmnessI18n = nameTable(
  'berry_firmness_i18n',
  'firmness_id',
  () => berryFirmness.id,
);

export const berries = sqliteTable('berries', {
  id: integer('id').primaryKey(),
  itemId: integer('item_id')
    .notNull()
    .unique()
    .references(() => items.id),
  firmnessId: integer('firmness_id').references(() => berryFirmness.id),
  naturalGiftPower: integer('natural_gift_power'),
  naturalGiftTypeId: integer('natural_gift_type_id').references(() => types.id),
  size: integer('size'),
  maxHarvest: integer('max_harvest'),
  growthTime: integer('growth_time'),
  soilDryness: integer('soil_dryness'),
  smoothness: integer('smoothness'),
});

export const berryFlavorMap = sqliteTable(
  'berry_flavor_map',
  {
    berryId: integer('berry_id')
      .notNull()
      .references(() => berries.id),
    flavorId: integer('flavor_id')
      .notNull()
      .references(() => flavors.id),
    potency: integer('potency').notNull(),
  },
  (t) => [primaryKey({ columns: [t.berryId, t.flavorId] })],
);

/** Where to find items in each game (RF05.2). Curated — PokeAPI has no such data. */
export const itemLocations = sqliteTable(
  'item_locations',
  {
    id: integer('id').primaryKey(),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    locationAreaId: integer('location_area_id').references(() => locationAreas.id),
    method: text('method'),
    notes: text('notes'),
  },
  (t) => [index('item_locations_item_idx').on(t.itemId, t.gameId)],
);
