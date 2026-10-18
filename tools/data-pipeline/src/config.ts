import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Pinned PokeAPI commit — bump deliberately and re-run `pnpm data:fetch`. */
export const POKEAPI_SHA = '6fd69dfe90465ba96534f6816fc817737d1f97f6';

/** Pinned PokeAPI/sprites and PokeAPI/cries commits (media downloaded on demand, RNF02). */
export const SPRITES_SHA = '7a7d66b1620e646f69afd48dc1273da9033ede9c';
export const CRIES_SHA = 'b3a9044bb839b5e3152aaa536c7b463a0fcf0140';
export const MEDIA_REPOS = { sprites: SPRITES_SHA, cries: CRIES_SHA } as const;
export type MediaRepo = keyof typeof MEDIA_REPOS;

/**
 * Packs TheDex transcodes from a pinned upstream directory and hosts itself (`pnpm media:pack`,
 * tools/media-pack). iOS cannot decode the `.ogg` cries, so they are re-encoded to AAC.
 * `baseUrl` is the pack root at an immutable published revision; file names and sizes come
 * from the committed listing (`mediaPackListingFile`).
 */
export const MEDIA_PACKS = {
  'cries-aac': {
    baseUrl:
      'https://raw.githubusercontent.com/samas-ai/TheDex/ce01d56ba04c674f683a83c1447bb6e29cf201f5/cries-aac',
  },
} as const satisfies Record<string, { readonly baseUrl: string }>;
export type MediaPack = keyof typeof MEDIA_PACKS;

export interface MediaSourceConfig {
  readonly style: string;
  readonly variant: string;
  readonly repo: MediaRepo;
  /**
   * What the files depict: Pokémon varieties (`<pokemon id>.<format>`, media_assets, the
   * default) or items (`<item identifier>.<format>`, item_icons).
   */
  readonly entity?: 'pokemon' | 'item';
  /** Directory inside the repo; files are named after the entity (see `entity`). */
  readonly dir: string;
  readonly format: 'png' | 'gif' | 'ogg' | 'm4a';
  /**
   * Hosted by TheDex: the files of `repo`/`dir` transcoded to `format` by tools/media-pack and
   * published under `MEDIA_PACKS[pack].baseUrl` with the same directory layout.
   */
  readonly pack?: MediaPack;
}

/**
 * Media styles → repo directories. `3d` uses Showdown's animated GIFs (rendered from the 3D
 * models). Cries are `.ogg` (Vorbis, some MP3), which iOS cannot play: `cry-aac` is the same
 * set transcoded to AAC (`.m4a`), picked by the app on iOS. `item` holds the bag icons of
 * the Item Dex (RF05.2).
 */
export const MEDIA_SOURCES: readonly MediaSourceConfig[] = [
  {
    style: 'official',
    variant: 'default',
    repo: 'sprites',
    dir: 'sprites/pokemon/other/official-artwork',
    format: 'png',
  },
  {
    style: 'official',
    variant: 'shiny',
    repo: 'sprites',
    dir: 'sprites/pokemon/other/official-artwork/shiny',
    format: 'png',
  },
  { style: 'pixel', variant: 'default', repo: 'sprites', dir: 'sprites/pokemon', format: 'png' },
  {
    style: 'pixel',
    variant: 'shiny',
    repo: 'sprites',
    dir: 'sprites/pokemon/shiny',
    format: 'png',
  },
  {
    style: '3d',
    variant: 'default',
    repo: 'sprites',
    dir: 'sprites/pokemon/other/showdown',
    format: 'gif',
  },
  {
    style: '3d',
    variant: 'shiny',
    repo: 'sprites',
    dir: 'sprites/pokemon/other/showdown/shiny',
    format: 'gif',
  },
  {
    style: 'home',
    variant: 'default',
    repo: 'sprites',
    dir: 'sprites/pokemon/other/home',
    format: 'png',
  },
  {
    style: 'home',
    variant: 'shiny',
    repo: 'sprites',
    dir: 'sprites/pokemon/other/home/shiny',
    format: 'png',
  },
  { style: 'cry', variant: 'latest', repo: 'cries', dir: 'cries/pokemon/latest', format: 'ogg' },
  { style: 'cry', variant: 'legacy', repo: 'cries', dir: 'cries/pokemon/legacy', format: 'ogg' },
  {
    style: 'cry-aac',
    variant: 'latest',
    repo: 'cries',
    dir: 'cries/pokemon/latest',
    format: 'm4a',
    pack: 'cries-aac',
  },
  {
    style: 'cry-aac',
    variant: 'legacy',
    repo: 'cries',
    dir: 'cries/pokemon/legacy',
    format: 'm4a',
    pack: 'cries-aac',
  },
  {
    style: 'item',
    variant: 'default',
    repo: 'sprites',
    entity: 'item',
    dir: 'sprites/items',
    format: 'png',
  },
];

/** Immutable download prefix of a media directory at its pinned commit (or pack revision). */
export function mediaBaseUrl(source: Pick<MediaSourceConfig, 'repo' | 'dir' | 'pack'>): string {
  if (source.pack) return `${MEDIA_PACKS[source.pack].baseUrl}/${source.dir}`;
  return `https://raw.githubusercontent.com/PokeAPI/${source.repo}/${MEDIA_REPOS[source.repo]}/${source.dir}`;
}

export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
export const PIPELINE_ROOT = path.join(REPO_ROOT, 'tools', 'data-pipeline');
export const CURATED_DIR = path.join(REPO_ROOT, 'data', 'curated');
export const SOURCES_DIR = path.join(REPO_ROOT, '.cache', 'sources');
export const POKEAPI_CSV_DIR = path.join(SOURCES_DIR, `pokeapi-${POKEAPI_SHA}`, 'csv');
/** Directory listings (file names + sizes) of MEDIA_SOURCES, written by `pnpm data:fetch`. */
export const MEDIA_LISTING_FILE = path.join(
  SOURCES_DIR,
  `media-${SPRITES_SHA.slice(0, 12)}-${CRIES_SHA.slice(0, 12)}.json`,
);
/** Committed listings of the published media packs, written by `pnpm media:pack`. */
export const MEDIA_PACK_DIR = path.join(REPO_ROOT, 'data', 'generated', 'media-packs');
export function mediaPackListingFile(pack: MediaPack, dir: string = MEDIA_PACK_DIR): string {
  return path.join(dir, `${pack}.json`);
}
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
  'item_game_indices',
  'item_names',
  'item_pocket_names',
  'item_pockets',
  'item_prose',
  'items',
  'languages',
  'location_area_prose',
  'location_areas',
  'location_game_indices',
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
