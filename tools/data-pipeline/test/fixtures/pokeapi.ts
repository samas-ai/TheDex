/**
 * Minimal, referentially consistent PokeAPI subset for integration tests. Each key is a
 * CSV file name; `writeFixtureCsvs` serializes these rows into a temp directory.
 * Language ids: 1 = ja-hrkt, 9 = en, 13 = pt-br.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MEDIA_REPOS, MEDIA_SOURCES } from '../../src/config';
import { formatMediaListing, type MediaListing } from '../../src/media-listing';

type Row = Record<string, string | number | null>;

const EN = 9;
const JA = 1;

const species = [
  // id, identifier, gen, evolves_from, chain, gender, capture, legendary
  [1, 'bulbasaur', 1, null, 1],
  [4, 'charmander', 1, null, 2],
  [5, 'charmeleon', 1, 4, 2],
  [6, 'charizard', 1, 5, 2],
  [25, 'pikachu', 1, null, 10],
  [35, 'clefairy', 1, null, 14],
  [81, 'magnemite', 1, null, 34],
  [390, 'chimchar', 4, null, 195],
  [737, 'charjabug', 7, null, 368],
  [935, 'charcadet', 9, null, 470],
] as const;

const speciesNames: Record<number, string> = {
  1: 'Bulbasaur',
  4: 'Charmander',
  5: 'Charmeleon',
  6: 'Charizard',
  25: 'Pikachu',
  35: 'Clefairy',
  81: 'Magnemite',
  390: 'Chimchar',
  737: 'Charjabug',
  935: 'Charcadet',
};

/** Current base stats: hp, atk, def, spa, spd, spe. */
const baseStats: Record<number, number[]> = {
  1: [45, 49, 49, 65, 65, 45],
  4: [39, 52, 43, 60, 50, 65],
  5: [58, 64, 58, 80, 65, 80],
  6: [78, 84, 78, 109, 85, 100],
  25: [35, 55, 40, 50, 50, 90],
  35: [70, 45, 48, 60, 65, 35],
  81: [25, 35, 70, 95, 55, 45],
  390: [44, 58, 44, 58, 44, 61],
  737: [57, 82, 95, 55, 75, 36],
  935: [40, 50, 40, 50, 40, 35],
  10034: [78, 130, 111, 130, 85, 100],
};

const types: Record<number, number[]> = {
  1: [12, 4],
  4: [10],
  5: [10],
  6: [10, 3],
  25: [13],
  35: [18],
  81: [13, 9],
  390: [10],
  737: [7, 13],
  935: [10],
  10034: [10, 16],
};

const pokemonIds = [...species.map((s) => s[0]), 10034];

export const FIXTURE_CSVS: Record<string, Row[]> = {
  languages: [
    { id: 1, iso639: 'ja', iso3166: 'jp', identifier: 'ja-hrkt', official: 1, order: 1 },
    { id: 9, iso639: 'en', iso3166: 'us', identifier: 'en', official: 1, order: 7 },
    { id: 13, iso639: 'pt', iso3166: 'br', identifier: 'pt-br', official: 1, order: 13 },
  ],
  regions: [
    { id: 1, identifier: 'kanto' },
    { id: 2, identifier: 'johto' },
    { id: 10, identifier: 'paldea' },
  ],
  generations: Array.from({ length: 9 }, (_, i) => ({
    id: i + 1,
    main_region_id: i === 0 ? 1 : i === 1 ? 2 : i === 8 ? 10 : null,
    identifier: `generation-${i + 1}`,
  })),
  version_groups: [
    { id: 1, identifier: 'red-blue', generation_id: 1, order: 3 },
    { id: 3, identifier: 'gold-silver', generation_id: 2, order: 5 },
    { id: 8, identifier: 'diamond-pearl', generation_id: 4, order: 12 },
    { id: 25, identifier: 'scarlet-violet', generation_id: 9, order: 27 },
    { id: 26, identifier: 'the-teal-mask', generation_id: 9, order: 28 },
  ],
  version_group_regions: [
    { version_group_id: 1, region_id: 1 },
    { version_group_id: 3, region_id: 2 },
    { version_group_id: 25, region_id: 10 },
    { version_group_id: 26, region_id: 10 },
  ],
  versions: [
    { id: 1, version_group_id: 1, identifier: 'red' },
    { id: 2, version_group_id: 1, identifier: 'blue' },
    { id: 4, version_group_id: 3, identifier: 'gold' },
    { id: 12, version_group_id: 8, identifier: 'diamond' },
    { id: 40, version_group_id: 25, identifier: 'scarlet' },
    { id: 41, version_group_id: 25, identifier: 'violet' },
    { id: 42, version_group_id: 26, identifier: 'the-teal-mask-scarlet' },
  ],
  version_names: [
    { version_id: 1, local_language_id: EN, name: 'Red' },
    { version_id: 2, local_language_id: EN, name: 'Blue' },
    { version_id: 4, local_language_id: EN, name: 'Gold' },
    { version_id: 12, local_language_id: EN, name: 'Diamond' },
    { version_id: 40, local_language_id: EN, name: 'Scarlet' },
    { version_id: 41, local_language_id: EN, name: 'Violet' },
  ],
  pokedexes: [
    { id: 2, region_id: 1, identifier: 'kanto', is_main_series: 1 },
    { id: 31, region_id: 10, identifier: 'paldea', is_main_series: 1 },
    { id: 32, region_id: 10, identifier: 'kitakami', is_main_series: 1 },
  ],
  pokedex_version_groups: [
    { pokedex_id: 2, version_group_id: 1 },
    { pokedex_id: 31, version_group_id: 25 },
    { pokedex_id: 32, version_group_id: 26 },
  ],
  pokemon_dex_numbers: [
    ...[1, 4, 5, 6, 25, 35, 81].map((id) => ({
      species_id: id,
      pokedex_id: 2,
      pokedex_number: id,
    })),
    { species_id: 25, pokedex_id: 31, pokedex_number: 74 },
    { species_id: 935, pokedex_id: 31, pokedex_number: 26 },
    { species_id: 4, pokedex_id: 32, pokedex_number: 150 },
    { species_id: 6, pokedex_id: 32, pokedex_number: 151 },
  ],
  types: [
    { id: 1, identifier: 'normal', generation_id: 1, damage_class_id: 2 },
    { id: 2, identifier: 'fighting', generation_id: 1, damage_class_id: 2 },
    { id: 3, identifier: 'flying', generation_id: 1, damage_class_id: 2 },
    { id: 4, identifier: 'poison', generation_id: 1, damage_class_id: 2 },
    { id: 7, identifier: 'bug', generation_id: 1, damage_class_id: 2 },
    { id: 9, identifier: 'steel', generation_id: 2, damage_class_id: 2 },
    { id: 10, identifier: 'fire', generation_id: 1, damage_class_id: 3 },
    { id: 12, identifier: 'grass', generation_id: 1, damage_class_id: 3 },
    { id: 13, identifier: 'electric', generation_id: 1, damage_class_id: 3 },
    { id: 16, identifier: 'dragon', generation_id: 1, damage_class_id: 3 },
    { id: 17, identifier: 'dark', generation_id: 2, damage_class_id: 3 },
    { id: 18, identifier: 'fairy', generation_id: 6, damage_class_id: null },
  ],
  type_names: [
    { type_id: 10, local_language_id: EN, name: 'Fire' },
    { type_id: 13, local_language_id: EN, name: 'Electric' },
    { type_id: 18, local_language_id: EN, name: 'Fairy' },
  ],
  stats: [
    { id: 1, damage_class_id: null, identifier: 'hp', is_battle_only: 0, game_index: 1 },
    { id: 2, damage_class_id: 2, identifier: 'attack', is_battle_only: 0, game_index: 2 },
    { id: 3, damage_class_id: 2, identifier: 'defense', is_battle_only: 0, game_index: 3 },
    { id: 4, damage_class_id: 3, identifier: 'special-attack', is_battle_only: 0, game_index: 5 },
    { id: 5, damage_class_id: 3, identifier: 'special-defense', is_battle_only: 0, game_index: 6 },
    { id: 6, damage_class_id: null, identifier: 'speed', is_battle_only: 0, game_index: 4 },
    { id: 9, damage_class_id: 3, identifier: 'special', is_battle_only: 0, game_index: 7 },
  ],
  stat_names: [{ stat_id: 4, local_language_id: EN, name: 'Special Attack' }],
  contest_types: [
    { id: 1, identifier: 'cool' },
    { id: 4, identifier: 'smart' },
  ],
  contest_type_names: [
    { contest_type_id: 1, local_language_id: EN, name: 'Cool', flavor: 'Spicy', color: 'Red' },
    { contest_type_id: 4, local_language_id: EN, name: 'Smart', flavor: 'Bitter', color: 'Green' },
  ],
  natures: [
    {
      id: 1,
      identifier: 'hardy',
      decreased_stat_id: 2,
      increased_stat_id: 2,
      hates_flavor_id: 1,
      likes_flavor_id: 1,
      game_index: 0,
    },
    {
      id: 3,
      identifier: 'adamant',
      decreased_stat_id: 4,
      increased_stat_id: 2,
      hates_flavor_id: 4,
      likes_flavor_id: 1,
      game_index: 3,
    },
  ],
  nature_names: [{ nature_id: 3, local_language_id: EN, name: 'Adamant' }],
  growth_rates: [{ id: 2, identifier: 'medium', formula: 'x^3' }],
  evolution_chains: [1, 2, 10, 14, 34, 195, 368, 470].map((id) => ({
    id,
    baby_trigger_item_id: null,
  })),
  pokemon_species: species.map(([id, identifier, gen, from, chain]) => ({
    id,
    identifier,
    generation_id: gen,
    evolves_from_species_id: from,
    evolution_chain_id: chain,
    gender_rate: 1,
    capture_rate: 45,
    base_happiness: 50,
    is_baby: 0,
    hatch_counter: 20,
    has_gender_differences: 0,
    growth_rate_id: 2,
    forms_switchable: 0,
    is_legendary: 0,
    is_mythical: 0,
    order: id,
  })),
  pokemon_species_names: [
    ...species.map(([id]) => ({
      pokemon_species_id: id,
      local_language_id: EN,
      name: speciesNames[id]!,
      genus: 'Test Pokémon',
    })),
    { pokemon_species_id: 25, local_language_id: JA, name: 'ピカチュウ', genus: 'ねずみポケモン' },
  ],
  pokemon: [
    ...species.map(([id, identifier]) => ({
      id,
      identifier,
      species_id: id,
      height: (id % 10) + 3,
      weight: id * 3,
      base_experience: 64,
      order: id,
      is_default: 1,
    })),
    {
      id: 10034,
      identifier: 'charizard-mega-x',
      species_id: 6,
      height: 17,
      weight: 1105,
      base_experience: 285,
      order: 7,
      is_default: 0,
    },
  ],
  pokemon_forms: [
    ...species.map(([id, identifier, gen]) => ({
      id,
      identifier,
      form_identifier: null,
      pokemon_id: id,
      introduced_in_version_group_id: gen === 1 ? 1 : gen === 4 ? 8 : 25,
      is_default: 1,
      is_battle_only: 0,
      is_mega: 0,
      form_order: 1,
      order: id,
    })),
    {
      id: 10034,
      identifier: 'charizard-mega-x',
      form_identifier: 'mega-x',
      pokemon_id: 10034,
      introduced_in_version_group_id: 25,
      is_default: 1,
      is_battle_only: 1,
      is_mega: 1,
      form_order: 2,
      order: 8,
    },
  ],
  pokemon_form_names: [
    {
      pokemon_form_id: 10034,
      local_language_id: EN,
      form_name: 'Mega X',
      pokemon_name: 'Mega Charizard X',
    },
  ],
  pokemon_types: pokemonIds.flatMap((id) =>
    types[id]!.map((type, index) => ({ pokemon_id: id, type_id: type, slot: index + 1 })),
  ),
  pokemon_types_past: [
    { pokemon_id: 35, generation_id: 5, type_id: 1, slot: 1 },
    { pokemon_id: 81, generation_id: 1, type_id: 13, slot: 1 },
  ],
  abilities: [
    { id: 34, identifier: 'chlorophyll', generation_id: 3, is_main_series: 1 },
    { id: 65, identifier: 'overgrow', generation_id: 3, is_main_series: 1 },
    { id: 66, identifier: 'blaze', generation_id: 3, is_main_series: 1 },
  ],
  ability_names: [
    { ability_id: 65, local_language_id: EN, name: 'Overgrow' },
    { ability_id: 34, local_language_id: EN, name: 'Chlorophyll' },
  ],
  pokemon_abilities: [
    { pokemon_id: 1, ability_id: 65, is_hidden: 0, slot: 1 },
    { pokemon_id: 1, ability_id: 34, is_hidden: 1, slot: 3 },
    { pokemon_id: 4, ability_id: 66, is_hidden: 0, slot: 1 },
  ],
  pokemon_abilities_past: [
    { pokemon_id: 1, generation_id: 4, ability_id: null, is_hidden: 1, slot: 3 },
  ],
  pokemon_stats: pokemonIds.flatMap((id) =>
    baseStats[id]!.map((base, index) => ({
      pokemon_id: id,
      stat_id: index + 1,
      base_stat: base,
      effort: index === 3 ? 1 : 0,
    })),
  ),
  pokemon_stats_past: [
    { pokemon_id: 1, generation_id: 1, stat_id: 9, base_stat: 65, effort: 0 },
    { pokemon_id: 25, generation_id: 5, stat_id: 3, base_stat: 30, effort: 0 },
  ],
  move_damage_classes: [
    { id: 1, identifier: 'status' },
    { id: 2, identifier: 'physical' },
    { id: 3, identifier: 'special' },
  ],
  move_targets: [{ id: 10, identifier: 'selected-pokemon' }],
  move_effects: [{ id: 1 }, { id: 7 }],
  move_effect_prose: [
    {
      move_effect_id: 7,
      local_language_id: EN,
      short_effect: 'Has a $effect_chance% chance to make the target [flinch]{mechanic:flinch}.',
      effect: 'Inflicts regular damage. Has a $effect_chance% chance to make the target flinch.',
    },
  ],
  pokemon_move_methods: [
    { id: 1, identifier: 'level-up' },
    { id: 4, identifier: 'machine' },
  ],
  moves: [
    {
      id: 1,
      identifier: 'pound',
      generation_id: 1,
      type_id: 1,
      power: 40,
      pp: 35,
      accuracy: 100,
      priority: 0,
      target_id: 10,
      damage_class_id: 2,
      effect_id: 1,
      effect_chance: null,
    },
    {
      id: 2,
      identifier: 'karate-chop',
      generation_id: 1,
      type_id: 2,
      power: 50,
      pp: 25,
      accuracy: 100,
      priority: 0,
      target_id: 10,
      damage_class_id: 2,
      effect_id: 1,
      effect_chance: null,
    },
    {
      id: 44,
      identifier: 'bite',
      generation_id: 1,
      type_id: 17,
      power: 60,
      pp: 25,
      accuracy: 100,
      priority: 0,
      target_id: 10,
      damage_class_id: 2,
      effect_id: 7,
      effect_chance: 30,
    },
    {
      id: 53,
      identifier: 'flamethrower',
      generation_id: 1,
      type_id: 10,
      power: 90,
      pp: 15,
      accuracy: 100,
      priority: 0,
      target_id: 10,
      damage_class_id: 3,
      effect_id: 1,
      effect_chance: 10,
    },
    {
      id: 85,
      identifier: 'thunderbolt',
      generation_id: 1,
      type_id: 13,
      power: 90,
      pp: 15,
      accuracy: 100,
      priority: 0,
      target_id: 10,
      damage_class_id: 3,
      effect_id: 1,
      effect_chance: 10,
    },
  ],
  move_changelog: [
    {
      move_id: 2,
      changed_in_version_group_id: 3,
      type_id: 1,
      power: null,
      pp: null,
      accuracy: null,
      priority: null,
      target_id: null,
      effect_id: null,
      effect_chance: null,
    },
    {
      move_id: 44,
      changed_in_version_group_id: 3,
      type_id: 1,
      power: null,
      pp: null,
      accuracy: null,
      priority: null,
      target_id: null,
      effect_id: null,
      effect_chance: null,
    },
    {
      move_id: 53,
      changed_in_version_group_id: 8,
      type_id: null,
      power: 95,
      pp: null,
      accuracy: null,
      priority: null,
      target_id: null,
      effect_id: null,
      effect_chance: null,
    },
  ],
  move_names: [
    { move_id: 85, local_language_id: EN, name: 'Thunderbolt' },
    { move_id: 53, local_language_id: EN, name: 'Flamethrower' },
    { move_id: 44, local_language_id: EN, name: 'Bite' },
  ],
  pokemon_moves: [
    {
      pokemon_id: 1,
      version_group_id: 1,
      move_id: 1,
      pokemon_move_method_id: 1,
      level: 1,
      order: 1,
      mastery: null,
    },
    {
      pokemon_id: 25,
      version_group_id: 1,
      move_id: 85,
      pokemon_move_method_id: 4,
      level: 0,
      order: null,
      mastery: null,
    },
    {
      pokemon_id: 25,
      version_group_id: 25,
      move_id: 85,
      pokemon_move_method_id: 4,
      level: 0,
      order: null,
      mastery: null,
    },
    {
      pokemon_id: 25,
      version_group_id: 25,
      move_id: 1,
      pokemon_move_method_id: 1,
      level: 1,
      order: 1,
      mastery: null,
    },
    // DLC rows: one identical to the base game (dedupable), one new.
    {
      pokemon_id: 25,
      version_group_id: 26,
      move_id: 85,
      pokemon_move_method_id: 4,
      level: 0,
      order: null,
      mastery: null,
    },
    {
      pokemon_id: 25,
      version_group_id: 26,
      move_id: 44,
      pokemon_move_method_id: 4,
      level: 0,
      order: null,
      mastery: null,
    },
    // Duplicate row (PokeAPI occasionally repeats rows).
    {
      pokemon_id: 25,
      version_group_id: 26,
      move_id: 44,
      pokemon_move_method_id: 4,
      level: 0,
      order: null,
      mastery: null,
    },
    {
      pokemon_id: 935,
      version_group_id: 25,
      move_id: 53,
      pokemon_move_method_id: 1,
      level: 15,
      order: 1,
      mastery: null,
    },
    {
      pokemon_id: 6,
      version_group_id: 25,
      move_id: 53,
      pokemon_move_method_id: 1,
      level: 1,
      order: 1,
      mastery: null,
    },
    {
      pokemon_id: 4,
      version_group_id: 26,
      move_id: 53,
      pokemon_move_method_id: 1,
      level: 20,
      order: 1,
      mastery: null,
    },
  ],
  item_pockets: [
    { id: 2, identifier: 'medicine' },
    { id: 5, identifier: 'berries' },
    { id: 4, identifier: 'machines' },
    { id: 7, identifier: 'battle' },
  ],
  item_categories: [
    { id: 3, pocket_id: 5, identifier: 'medicine' },
    { id: 27, pocket_id: 2, identifier: 'healing' },
    { id: 37, pocket_id: 4, identifier: 'all-machines' },
    { id: 44, pocket_id: 7, identifier: 'mega-stones' },
  ],
  items: [
    {
      id: 17,
      identifier: 'potion',
      category_id: 27,
      cost: 200,
      fling_power: 30,
      fling_effect_id: null,
    },
    {
      id: 660,
      identifier: 'charizardite-x',
      category_id: 44,
      cost: 0,
      fling_power: 80,
      fling_effect_id: null,
    },
    {
      id: 328,
      identifier: 'tm24',
      category_id: 37,
      cost: 3000,
      fling_power: null,
      fling_effect_id: null,
    },
    {
      id: 132,
      identifier: 'oran-berry',
      category_id: 3,
      cost: 80,
      fling_power: 10,
      fling_effect_id: 3,
    },
  ],
  item_names: [
    { item_id: 17, local_language_id: EN, name: 'Potion' },
    { item_id: 132, local_language_id: EN, name: 'Oran Berry' },
    { item_id: 328, local_language_id: EN, name: 'TM24' },
  ],
  item_prose: [
    {
      item_id: 17,
      local_language_id: EN,
      short_effect: 'Restores 20 [HP]{mechanic:hp}.',
      effect: 'Used on a party Pokémon: restores 20 HP.',
    },
    {
      item_id: 328,
      local_language_id: EN,
      short_effect: 'Teaches Water Gun to a compatible Pokémon.',
      effect: 'Teaches Water Gun to a compatible Pokémon.',
    },
  ],
  item_fling_effects: [{ id: 3, identifier: 'berry-effect' }],
  item_fling_effect_prose: [
    { item_fling_effect_id: 3, local_language_id: EN, effect: 'Activates the berry’s effect.' },
  ],
  item_flags: [{ id: 5, identifier: 'holdable' }],
  item_flag_prose: [
    {
      item_flag_id: 5,
      local_language_id: EN,
      name: 'Holdable',
      description: 'Can be held by a Pokémon',
    },
  ],
  item_flag_map: [{ item_id: 132, item_flag_id: 5 }],
  item_game_indices: [
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((gen) => ({
      item_id: 17,
      generation_id: gen,
      game_index: 17,
    })),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((gen) => ({
      item_id: 328,
      generation_id: gen,
      game_index: 24,
    })),
    ...[3, 9].map((gen) => ({ item_id: 132, generation_id: gen, game_index: 139 })),
    { item_id: 660, generation_id: 6, game_index: 660 },
  ],
  berry_firmness: [{ id: 5, identifier: 'super-hard' }],
  berry_firmness_names: [{ berry_firmness_id: 5, local_language_id: EN, name: 'Super Hard' }],
  berries: [
    {
      id: 7,
      item_id: 132,
      firmness_id: 5,
      natural_gift_power: 60,
      natural_gift_type_id: 4,
      size: 35,
      max_harvest: 5,
      growth_time: 4,
      soil_dryness: 15,
      smoothness: 20,
    },
  ],
  berry_flavors: [
    { berry_id: 7, contest_type_id: 1, flavor: 10 },
    { berry_id: 7, contest_type_id: 4, flavor: 0 },
  ],
  machines: [{ machine_number: 24, version_group_id: 1, item_id: 328, move_id: 85 }],

  // Breeding, growth, evolution (RF02.2 / RF02.5)
  egg_groups: [
    { id: 1, identifier: 'monster' },
    { id: 14, identifier: 'dragon' },
  ],
  egg_group_prose: [
    { egg_group_id: 1, local_language_id: EN, name: 'Monster' },
    { egg_group_id: 14, local_language_id: EN, name: 'Dragon' },
  ],
  pokemon_egg_groups: [
    { species_id: 4, egg_group_id: 1 },
    { species_id: 4, egg_group_id: 14 },
  ],
  growth_rate_prose: [{ growth_rate_id: 2, local_language_id: EN, name: 'medium' }],
  evolution_triggers: [
    { id: 1, identifier: 'level-up' },
    { id: 3, identifier: 'use-item' },
  ],
  evolution_trigger_prose: [{ evolution_trigger_id: 1, local_language_id: EN, name: 'Level up' }],
  pokemon_evolution: [
    {
      id: 1,
      evolved_species_id: 5,
      evolution_trigger_id: 1,
      version_group_id: 1,
      is_default: 1,
      minimum_level: 16,
      trigger_item_id: null,
    },
    {
      id: 2,
      evolved_species_id: 6,
      evolution_trigger_id: 1,
      version_group_id: 1,
      is_default: 1,
      minimum_level: 36,
    },
    // Superseded in a later game (fictional): Charmeleon by Potion from Scarlet/Violet.
    {
      id: 3,
      evolved_species_id: 5,
      evolution_trigger_id: 3,
      version_group_id: 25,
      is_default: 0,
      trigger_item_id: 17,
    },
  ],

  // Abilities prose (RF02.2 sheet)
  ability_prose: [
    {
      ability_id: 34,
      local_language_id: EN,
      short_effect: 'Doubles Speed during strong sunlight.',
      effect:
        'Doubles Speed during [strong sunlight]{mechanic:strong-sunlight}.\n\nOverworld: A fictional field effect.',
    },
    {
      ability_id: 65,
      local_language_id: EN,
      short_effect: 'Strengthens [grass]{type:grass} moves to 1.5× in a pinch.',
      effect:
        'When this Pokémon has 1/3 or less of its [HP]{mechanic:hp} remaining, its grass-type moves inflict 1.5× as much [regular damage]{mechanic:regular-damage}.',
    },
  ],
  ability_flavor_text: [
    {
      ability_id: 65,
      version_group_id: 8,
      language_id: EN,
      flavor_text: 'Ups GRASS moves in a pinch.',
    },
    {
      ability_id: 65,
      version_group_id: 25,
      language_id: EN,
      flavor_text: 'Powers up Grass-type moves when the Pokémon’s HP is low.',
    },
  ],

  // Wild encounters (RF02.7): Pikachu in Viridian Forest in Red and Blue.
  locations: [
    { id: 70, region_id: 1, identifier: 'cinnabar-island' },
    { id: 86, region_id: 1, identifier: 'pallet-town' },
    { id: 155, region_id: 1, identifier: 'viridian-forest' },
  ],
  location_names: [
    { location_id: 70, local_language_id: EN, name: 'Cinnabar Island', subtitle: null },
    { location_id: 86, local_language_id: EN, name: 'Pallet Town', subtitle: null },
    { location_id: 155, local_language_id: EN, name: 'Viridian Forest', subtitle: null },
  ],
  location_game_indices: [
    { location_id: 86, generation_id: 1, game_index: 0 },
    { location_id: 155, generation_id: 1, game_index: 51 },
    { location_id: 155, generation_id: 1, game_index: 52 },
  ],
  location_areas: [{ id: 321, location_id: 155, game_index: 1, identifier: null }],
  location_area_prose: [{ location_area_id: 321, local_language_id: EN, name: '' }],
  encounter_methods: [{ id: 1, identifier: 'walk', order: 1 }],
  encounter_method_prose: [
    { encounter_method_id: 1, local_language_id: EN, name: 'Walking in tall grass or a cave' },
  ],
  encounter_slots: [
    { id: 1, version_group_id: 1, encounter_method_id: 1, slot: 1, rarity: 5 },
    { id: 2, version_group_id: 1, encounter_method_id: 1, slot: 2, rarity: 10 },
  ],
  encounters: [
    {
      id: 1,
      version_id: 1,
      location_area_id: 321,
      encounter_slot_id: 1,
      pokemon_id: 25,
      min_level: 3,
      max_level: 5,
    },
    {
      id: 2,
      version_id: 2,
      location_area_id: 321,
      encounter_slot_id: 1,
      pokemon_id: 25,
      min_level: 3,
      max_level: 5,
    },
    {
      id: 3,
      version_id: 1,
      location_area_id: 321,
      encounter_slot_id: 2,
      pokemon_id: 25,
      min_level: 4,
      max_level: 6,
    },
  ],
  encounter_conditions: [{ id: 2, identifier: 'time' }],
  encounter_condition_prose: [
    { encounter_condition_id: 2, local_language_id: EN, name: 'Time of day' },
  ],
  encounter_condition_values: [
    { id: 5, encounter_condition_id: 2, identifier: 'time-night', is_default: 0 },
  ],
  encounter_condition_value_prose: [
    { encounter_condition_value_id: 5, local_language_id: EN, name: 'At night' },
  ],
  encounter_condition_value_map: [{ encounter_id: 3, encounter_condition_value_id: 5 }],
  pokemon_species_flavor_text: [
    {
      species_id: 25,
      version_id: 1,
      language_id: EN,
      flavor_text: 'When several of\nthese POKéMON\fgather, their elec­\ntricity could build.',
    },
    {
      species_id: 25,
      version_id: 2,
      language_id: EN,
      flavor_text: 'When several of\nthese POKéMON\fgather, their elec­\ntricity could build.',
    },
  ],
};

export function writeFixtureCsvs(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const [name, rows] of Object.entries(FIXTURE_CSVS)) {
    const columns = Object.keys(rows[0] ?? {});
    const escape = (value: string | number | null) => {
      if (value === null) return '';
      const text = String(value);
      return /[",\n\f]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    const lines = [
      columns.join(','),
      ...rows.map((row) => columns.map((c) => escape(row[c] ?? null)).join(',')),
    ];
    writeFileSync(path.join(dir, `${name}.csv`), `${lines.join('\n')}\n`);
  }
}

/**
 * Upstream listing (`file`) plus the committed pack listings (`packDir`): every Pokémon source
 * lists Charizard, Pikachu, Mega Charizard X (except 3D) and a non-Pokémon file; the item icon
 * source lists Potion, TM24 and an unknown item.
 */
export function writeFixtureMediaListing(file: string, packDir: string): void {
  const dirs: Record<string, [string, number][]> = {};
  const packs: Record<string, MediaListing> = {};
  for (const source of MEDIA_SOURCES) {
    const entries: [string, number][] =
      source.entity === 'item'
        ? [
            ['potion.png', 300],
            ['tm24.png', 200],
            ['unknown-item.png', 10],
          ]
        : [
            [`25.${source.format}`, 1000],
            [`6.${source.format}`, 2000],
            [`egg.${source.format}`, 10],
          ];
    // The Mega has no 3D (Showdown) sprite at the pinned commit.
    if (source.style !== '3d' && source.entity !== 'item') {
      entries.push([`10034.${source.format}`, 3000]);
    }
    const key = `${source.repo}/${source.dir}`;
    if (source.pack) {
      const pack = (packs[source.pack] ??= { repos: {}, dirs: {} });
      pack.repos[source.repo] = MEDIA_REPOS[source.repo];
      pack.dirs[key] = entries;
    } else {
      dirs[key] = entries;
    }
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ repos: { ...MEDIA_REPOS }, dirs }));
  mkdirSync(packDir, { recursive: true });
  for (const [pack, listing] of Object.entries(packs)) {
    writeFileSync(path.join(packDir, `${pack}.json`), formatMediaListing(listing));
  }
}

/** Curated files matching the fixture subset. */
export const FIXTURE_CURATED: Record<string, unknown> = {
  'games.json': {
    games: [
      { identifier: 'red-blue', versionGroups: ['red-blue'], pokedexes: ['kanto'], mechanics: [] },
      { identifier: 'gold-silver', versionGroups: ['gold-silver'], pokedexes: [], mechanics: [] },
      {
        identifier: 'diamond-pearl',
        versionGroups: ['diamond-pearl'],
        pokedexes: [],
        mechanics: [],
      },
      {
        identifier: 'scarlet-violet',
        versionGroups: ['scarlet-violet', 'the-teal-mask'],
        pokedexes: ['paldea', 'kitakami'],
        mechanics: ['tera', 'mega'],
      },
    ],
  },
  'species-tags.json': { starter: ['bulbasaur', 'charmander', 'chimchar'], paradox: [] },
  'i18n-pt-BR.json': {
    type_i18n: { fire: { name: 'Fogo' }, electric: { name: 'Elétrico' } },
    stat_i18n: { 'special-attack': { name: 'Atq. Esp.' } },
    nature_i18n: { adamant: { name: 'Firme' } },
    move_damage_class_i18n: { physical: { name: 'Físico' }, special: { name: 'Especial' } },
  },
  'search-aliases.json': { pokemon: { pikachu: ['rato eletrico'] } },
  'ps-id-overrides.json': { pokemon: {} },
  'ability-overworld.json': {
    blaze: { en: 'A fictional field effect for tests.', 'pt-BR': 'Um efeito de campo fictício.' },
  },
  'location-kinds.json': { 'cinnabar-island': 'city' },
};

export function writeFixtureCurated(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const [file, content] of Object.entries(FIXTURE_CURATED)) {
    writeFileSync(path.join(dir, file), JSON.stringify(content, null, 2));
  }
}
