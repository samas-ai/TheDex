import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { nameTable } from './helpers';

/** Build metadata: schema_version, data_version, source SHAs, built_at. */
export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const languages = sqliteTable('languages', {
  /** BCP-47 code, e.g. `en`, `ja-Hrkt`, `pt-BR`. */
  code: text('code').primaryKey(),
  pokeapiId: integer('pokeapi_id').notNull().unique(),
  iso639: text('iso639').notNull(),
  iso3166: text('iso3166').notNull(),
  isOfficial: integer('is_official', { mode: 'boolean' }).notNull(),
  sortOrder: integer('sort_order').notNull(),
  /** True when the language has translated game data (names) in this build. */
  hasGameData: integer('has_game_data', { mode: 'boolean' }).notNull(),
});

export const regions = sqliteTable('regions', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
});
export const regionI18n = nameTable('region_i18n', 'region_id', () => regions.id);

export const generations = sqliteTable('generations', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
  mainRegionId: integer('main_region_id').references(() => regions.id),
});
export const generationI18n = nameTable('generation_i18n', 'generation_id', () => generations.id);

export const versionGroups = sqliteTable('version_groups', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
  generationId: integer('generation_id')
    .notNull()
    .references(() => generations.id),
  sortOrder: integer('sort_order').notNull(),
});

export const versionGroupRegions = sqliteTable(
  'version_group_regions',
  {
    versionGroupId: integer('version_group_id')
      .notNull()
      .references(() => versionGroups.id),
    regionId: integer('region_id')
      .notNull()
      .references(() => regions.id),
  },
  (t) => [primaryKey({ columns: [t.versionGroupId, t.regionId] })],
);

export const versions = sqliteTable('versions', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
  versionGroupId: integer('version_group_id')
    .notNull()
    .references(() => versionGroups.id),
});
export const versionI18n = nameTable('version_i18n', 'version_id', () => versions.id);

export const pokedexes = sqliteTable('pokedexes', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
  regionId: integer('region_id').references(() => regions.id),
  isMainSeries: integer('is_main_series', { mode: 'boolean' }).notNull(),
});

export const pokedexI18n = sqliteTable(
  'pokedex_i18n',
  {
    pokedexId: integer('pokedex_id')
      .notNull()
      .references(() => pokedexes.id),
    lang: text('lang')
      .notNull()
      .references(() => languages.code),
    name: text('name').notNull(),
    description: text('description'),
  },
  (t) => [primaryKey({ columns: [t.pokedexId, t.lang] })],
);

export const pokedexVersionGroups = sqliteTable(
  'pokedex_version_groups',
  {
    pokedexId: integer('pokedex_id')
      .notNull()
      .references(() => pokedexes.id),
    versionGroupId: integer('version_group_id')
      .notNull()
      .references(() => versionGroups.id),
  },
  (t) => [primaryKey({ columns: [t.pokedexId, t.versionGroupId] })],
);

/** Curated "game" (data/curated/games.json): what the global selector (RF01.2) picks. */
export const games = sqliteTable('games', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull().unique(),
  generationId: integer('generation_id')
    .notNull()
    .references(() => generations.id),
  sortOrder: integer('sort_order').notNull(),
  hasMega: integer('has_mega', { mode: 'boolean' }).notNull(),
  hasZ: integer('has_z', { mode: 'boolean' }).notNull(),
  hasDynamax: integer('has_dynamax', { mode: 'boolean' }).notNull(),
  hasTera: integer('has_tera', { mode: 'boolean' }).notNull(),
});
export const gameI18n = nameTable('game_i18n', 'game_id', () => games.id);

export const gameVersionGroups = sqliteTable(
  'game_version_groups',
  {
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    versionGroupId: integer('version_group_id')
      .notNull()
      .references(() => versionGroups.id),
    /** The main version group of the game (DLC version groups are not base). */
    isBase: integer('is_base', { mode: 'boolean' }).notNull(),
    sortOrder: integer('sort_order').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.versionGroupId] }),
    index('game_version_groups_vg_idx').on(t.versionGroupId),
  ],
);

export const gameVersions = sqliteTable(
  'game_versions',
  {
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    versionId: integer('version_id')
      .notNull()
      .references(() => versions.id),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.versionId] })],
);

export const gamePokedexes = sqliteTable(
  'game_pokedexes',
  {
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    pokedexId: integer('pokedex_id')
      .notNull()
      .references(() => pokedexes.id),
    sortOrder: integer('sort_order').notNull(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.pokedexId] })],
);
