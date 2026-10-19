import { is } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as abilities from './abilities';
import * as core from './core';
import * as items from './items';
import * as locations from './locations';
import * as misc from './misc';
import * as moves from './moves';
import * as pokemon from './pokemon';
import * as search from './search';
import * as text from './text';

export * from './abilities';
export * from './core';
export * from './items';
export * from './locations';
export * from './misc';
export * from './moves';
export * from './pokemon';
export * from './search';
export * from './text';

/**
 * Version of the game-data schema. Bump whenever a table or column changes; it is written
 * to `meta.schema_version` and to `PRAGMA user_version`.
 */
export const GAME_SCHEMA_VERSION = 4;

/** Every game-data table, in a stable order. */
export const gameTables: readonly SQLiteTable[] = [
  core,
  misc,
  pokemon,
  moves,
  abilities,
  items,
  locations,
  text,
  search,
].flatMap((module) =>
  Object.values(module).filter((value): value is SQLiteTable => is(value, SQLiteTable)),
);

/**
 * Tables created WITHOUT ROWID: small rows with a composite primary key (i18n names,
 * junction tables, per-generation materializations, learnsets). Never long prose.
 */
export const WITHOUT_ROWID_TABLES: ReadonlySet<string> = new Set([
  // Translated names
  'region_i18n',
  'generation_i18n',
  'version_i18n',
  'game_i18n',
  'type_i18n',
  'stat_i18n',
  'flavor_i18n',
  'nature_i18n',
  'growth_rate_i18n',
  'egg_group_i18n',
  'evolution_trigger_i18n',
  'move_i18n',
  'move_meta_ailment_i18n',
  'ability_i18n',
  'item_pocket_i18n',
  'item_category_i18n',
  'item_i18n',
  'berry_firmness_i18n',
  'location_i18n',
  'location_area_i18n',
  'encounter_method_i18n',
  'encounter_condition_i18n',
  'encounter_condition_value_i18n',
  'species_i18n',
  'form_i18n',
  // Junctions and materializations
  'version_group_regions',
  'pokedex_version_groups',
  'game_version_groups',
  'game_versions',
  'game_pokedexes',
  'species_tags',
  'pokemon_egg_groups',
  'pokemon_dex_numbers',
  'pokemon_form_types',
  'form_changes',
  'pokemon_types_by_gen',
  'pokemon_abilities_by_gen',
  'pokemon_stats_by_gen',
  'game_pokemon',
  'move_stats_by_vg',
  'move_meta_stat_changes',
  'move_flag_map',
  'pokemon_moves',
  'machines',
  'item_flag_map',
  'item_generations',
  'location_generations',
  'berry_flavor_map',
  'encounter_condition_value_map',
  'media_sources',
  'media_assets',
  'species_flavor_text',
  'move_flavor_text',
  'ability_flavor_text',
  'item_flavor_text',
]);
