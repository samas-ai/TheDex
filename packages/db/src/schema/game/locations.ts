import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { languages, regions, versionGroups, versions } from './core';
import { nameTable } from './helpers';
import { pokemon } from './pokemon';

export const locations = sqliteTable(
  'locations',
  {
    id: integer('id').primaryKey(),
    identifier: text('identifier').notNull(),
    regionId: integer('region_id').references(() => regions.id),
    /** city | route | cave | water | building | area (Phase 3 heuristic). */
    locationKind: text('location_kind'),
  },
  (t) => [index('locations_region_idx').on(t.regionId)],
);

export const locationI18n = sqliteTable(
  'location_i18n',
  {
    locationId: integer('location_id')
      .notNull()
      .references(() => locations.id),
    lang: text('lang')
      .notNull()
      .references(() => languages.code),
    name: text('name').notNull(),
    subtitle: text('subtitle'),
  },
  (t) => [primaryKey({ columns: [t.locationId, t.lang] })],
);

export const locationAreas = sqliteTable(
  'location_areas',
  {
    id: integer('id').primaryKey(),
    locationId: integer('location_id')
      .notNull()
      .references(() => locations.id),
    gameIndex: integer('game_index'),
    identifier: text('identifier'),
  },
  (t) => [index('location_areas_location_idx').on(t.locationId)],
);
export const locationAreaI18n = nameTable(
  'location_area_i18n',
  'location_area_id',
  () => locationAreas.id,
);

export const encounterMethods = sqliteTable('encounter_methods', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
  sortOrder: integer('sort_order'),
});
export const encounterMethodI18n = nameTable(
  'encounter_method_i18n',
  'method_id',
  () => encounterMethods.id,
);

export const encounterSlots = sqliteTable('encounter_slots', {
  id: integer('id').primaryKey(),
  versionGroupId: integer('version_group_id')
    .notNull()
    .references(() => versionGroups.id),
  methodId: integer('method_id')
    .notNull()
    .references(() => encounterMethods.id),
  slot: integer('slot'),
  rarity: integer('rarity'),
});

/**
 * One wild encounter. `slot_id` is optional and `rate_pct` / `extra_json` (weather, alpha,
 * outbreak…) leave room for the newer games' models.
 */
export const encounters = sqliteTable(
  'encounters',
  {
    id: integer('id').primaryKey(),
    versionId: integer('version_id')
      .notNull()
      .references(() => versions.id),
    locationAreaId: integer('location_area_id')
      .notNull()
      .references(() => locationAreas.id),
    pokemonId: integer('pokemon_id')
      .notNull()
      .references(() => pokemon.id),
    methodId: integer('method_id')
      .notNull()
      .references(() => encounterMethods.id),
    slotId: integer('slot_id').references(() => encounterSlots.id),
    minLevel: integer('min_level').notNull(),
    maxLevel: integer('max_level').notNull(),
    ratePct: integer('rate_pct'),
    extraJson: text('extra_json'),
  },
  (t) => [
    index('encounters_pokemon_idx').on(t.pokemonId, t.versionId),
    index('encounters_area_idx').on(t.locationAreaId, t.versionId),
  ],
);

export const encounterConditions = sqliteTable('encounter_conditions', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
});
export const encounterConditionI18n = nameTable(
  'encounter_condition_i18n',
  'condition_id',
  () => encounterConditions.id,
);

export const encounterConditionValues = sqliteTable('encounter_condition_values', {
  id: integer('id').primaryKey(),
  conditionId: integer('condition_id')
    .notNull()
    .references(() => encounterConditions.id),
  identifier: text('identifier').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull(),
});
export const encounterConditionValueI18n = nameTable(
  'encounter_condition_value_i18n',
  'condition_value_id',
  () => encounterConditionValues.id,
);

export const encounterConditionValueMap = sqliteTable(
  'encounter_condition_value_map',
  {
    encounterId: integer('encounter_id')
      .notNull()
      .references(() => encounters.id),
    conditionValueId: integer('condition_value_id')
      .notNull()
      .references(() => encounterConditionValues.id),
  },
  (t) => [primaryKey({ columns: [t.encounterId, t.conditionValueId] })],
);
