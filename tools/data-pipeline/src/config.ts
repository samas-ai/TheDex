import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Pinned PokeAPI commit — bump deliberately and re-run `pnpm data:fetch`. */
export const POKEAPI_SHA = '6fd69dfe90465ba96534f6816fc817737d1f97f6';

export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
export const PIPELINE_ROOT = path.join(REPO_ROOT, 'tools', 'data-pipeline');
export const CURATED_DIR = path.join(REPO_ROOT, 'data', 'curated');
export const SOURCES_DIR = path.join(REPO_ROOT, '.cache', 'sources');
export const POKEAPI_CSV_DIR = path.join(SOURCES_DIR, `pokeapi-${POKEAPI_SHA}`, 'csv');
export const DIST_DIR = path.join(PIPELINE_ROOT, 'dist');
export const DATA_DB_FILE = 'thedex-data.db';
export const MOBILE_DB_DIR = path.join(REPO_ROOT, 'apps', 'mobile', 'assets', 'db');
export const GENERATED_MANIFEST_TS = path.join(
  REPO_ROOT,
  'packages',
  'db',
  'src',
  'generated',
  'data-manifest.ts',
);

/** Size budget for thedex-data.db (bytes). */
export const SIZE_WARN_BYTES = 50 * 1024 * 1024;
export const SIZE_FAIL_BYTES = 60 * 1024 * 1024;

/** PokeAPI CSV files consumed by the pipeline (without extension). */
export const POKEAPI_CSV_FILES = [
  'abilities',
  'ability_flavor_text',
  'ability_names',
  'ability_prose',
  'berries',
  'berry_firmness',
  'berry_firmness_names',
  'berry_flavors',
  'contest_type_names',
  'contest_types',
  'egg_group_prose',
  'egg_groups',
  'encounter_condition_prose',
  'encounter_condition_value_map',
  'encounter_condition_value_prose',
  'encounter_condition_values',
  'encounter_conditions',
  'encounter_method_prose',
  'encounter_methods',
  'encounter_slots',
  'encounters',
  'evolution_chains',
  'evolution_trigger_prose',
  'evolution_triggers',
  'generation_names',
  'generations',
  'growth_rate_prose',
  'growth_rates',
  'item_categories',
  'item_category_prose',
  'item_flag_map',
  'item_flag_prose',
  'item_flags',
  'item_flavor_text',
  'item_fling_effect_prose',
  'item_fling_effects',
  'item_names',
  'item_pocket_names',
  'item_pockets',
  'item_prose',
  'items',
  'languages',
  'location_area_prose',
  'location_areas',
  'location_names',
  'locations',
  'machines',
  'move_changelog',
  'move_damage_class_prose',
  'move_damage_classes',
  'move_effect_prose',
  'move_effects',
  'move_flag_map',
  'move_flag_prose',
  'move_flags',
  'move_flavor_text',
  'move_meta',
  'move_meta_ailment_names',
  'move_meta_ailments',
  'move_meta_categories',
  'move_meta_category_prose',
  'move_meta_stat_changes',
  'move_names',
  'move_target_prose',
  'move_targets',
  'moves',
  'nature_names',
  'natures',
  'pokedex_prose',
  'pokedex_version_groups',
  'pokedexes',
  'pokemon',
  'pokemon_abilities',
  'pokemon_abilities_past',
  'pokemon_dex_numbers',
  'pokemon_egg_groups',
  'pokemon_evolution',
  'pokemon_form_names',
  'pokemon_form_types',
  'pokemon_forms',
  'pokemon_move_method_prose',
  'pokemon_move_methods',
  'pokemon_moves',
  'pokemon_species',
  'pokemon_species_flavor_text',
  'pokemon_species_names',
  'pokemon_stats',
  'pokemon_stats_past',
  'pokemon_types',
  'pokemon_types_past',
  'region_names',
  'regions',
  'stat_names',
  'stats',
  'type_efficacy',
  'type_efficacy_past',
  'type_names',
  'types',
  'version_group_regions',
  'version_groups',
  'version_names',
  'versions',
] as const;

export type PokeapiCsvFile = (typeof POKEAPI_CSV_FILES)[number];
