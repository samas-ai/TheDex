import type { BuildContext } from '../context';
import type { CsvRow } from '../csv';
import { toBool, toInt, toText, type SqlValue } from '../values';

type Getter = (row: CsvRow, ctx: BuildContext) => SqlValue;

/** Declarative CSV → table mapping. Column keys are target DB columns. */
export interface TableSpec {
  readonly csv: string;
  readonly table: string;
  readonly columns: Readonly<Record<string, Getter>>;
  /** Skip rows where any of these target columns is null (e.g. untranslated names). */
  readonly required?: readonly string[];
  /** Use INSERT OR IGNORE (PokeAPI occasionally repeats rows). */
  readonly orIgnore?: boolean;
}

const int =
  (column: string): Getter =>
  (row) =>
    toInt(row[column]);
const bool =
  (column: string): Getter =>
  (row) =>
    toBool(row[column]);
const str =
  (column: string): Getter =>
  (row) =>
    toText(row[column]);
const lang =
  (column = 'local_language_id'): Getter =>
  (row, ctx) =>
    ctx.languages.code(row[column]);

function entity(csv: string, table: string, extra: Record<string, Getter> = {}): TableSpec {
  return { csv, table, columns: { id: int('id'), identifier: str('identifier'), ...extra } };
}

function names(
  csv: string,
  table: string,
  idColumn: string,
  csvIdColumn: string,
  nameColumn = 'name',
): TableSpec {
  return {
    csv,
    table,
    columns: { [idColumn]: int(csvIdColumn), lang: lang(), name: str(nameColumn) },
    required: ['lang', 'name'],
  };
}

function described(csv: string, table: string, idColumn: string, csvIdColumn: string): TableSpec {
  return {
    csv,
    table,
    columns: {
      [idColumn]: int(csvIdColumn),
      lang: lang(),
      name: str('name'),
      description: str('description'),
    },
    required: ['lang', 'name'],
  };
}

function prose(csv: string, table: string, idColumn: string, csvIdColumn: string): TableSpec {
  return {
    csv,
    table,
    columns: {
      [idColumn]: int(csvIdColumn),
      lang: lang(),
      short_effect: str('short_effect'),
      effect: str('effect'),
    },
    required: ['lang'],
  };
}

function junction(csv: string, table: string, columns: Record<string, string>): TableSpec {
  return {
    csv,
    table,
    columns: Object.fromEntries(Object.entries(columns).map(([to, from]) => [to, int(from)])),
  };
}

/** Straight 1:1 loads. Derived tables (by_gen, games, search…) are built in `derive/`. */
export const TABLE_SPECS: readonly TableSpec[] = [
  // Core
  entity('regions', 'regions'),
  names('region_names', 'region_i18n', 'region_id', 'region_id'),
  entity('generations', 'generations', { main_region_id: int('main_region_id') }),
  names('generation_names', 'generation_i18n', 'generation_id', 'generation_id'),
  entity('version_groups', 'version_groups', {
    generation_id: int('generation_id'),
    sort_order: int('order'),
  }),
  junction('version_group_regions', 'version_group_regions', {
    version_group_id: 'version_group_id',
    region_id: 'region_id',
  }),
  entity('versions', 'versions', { version_group_id: int('version_group_id') }),
  names('version_names', 'version_i18n', 'version_id', 'version_id'),
  entity('pokedexes', 'pokedexes', {
    region_id: int('region_id'),
    is_main_series: bool('is_main_series'),
  }),
  {
    csv: 'pokedex_prose',
    table: 'pokedex_i18n',
    columns: {
      pokedex_id: int('pokedex_id'),
      lang: lang(),
      name: str('name'),
      description: str('description'),
    },
    required: ['lang', 'name'],
  },
  junction('pokedex_version_groups', 'pokedex_version_groups', {
    pokedex_id: 'pokedex_id',
    version_group_id: 'version_group_id',
  }),

  // Types, stats, natures
  entity('types', 'types', {
    generation_id: int('generation_id'),
    legacy_damage_class_id: int('damage_class_id'),
  }),
  names('type_names', 'type_i18n', 'type_id', 'type_id'),
  entity('stats', 'stats', {
    damage_class_id: int('damage_class_id'),
    is_battle_only: bool('is_battle_only'),
    game_index: int('game_index'),
  }),
  names('stat_names', 'stat_i18n', 'stat_id', 'stat_id'),
  names('contest_type_names', 'flavor_i18n', 'flavor_id', 'contest_type_id', 'flavor'),
  entity('natures', 'natures', {
    increased_stat_id: int('increased_stat_id'),
    decreased_stat_id: int('decreased_stat_id'),
    likes_flavor_id: int('likes_flavor_id'),
    hates_flavor_id: int('hates_flavor_id'),
    game_index: int('game_index'),
  }),
  names('nature_names', 'nature_i18n', 'nature_id', 'nature_id'),

  // Species and varieties
  entity('growth_rates', 'growth_rates', { formula: str('formula') }),
  names('growth_rate_prose', 'growth_rate_i18n', 'growth_rate_id', 'growth_rate_id'),
  entity('egg_groups', 'egg_groups'),
  names('egg_group_prose', 'egg_group_i18n', 'egg_group_id', 'egg_group_id'),
  {
    csv: 'evolution_chains',
    table: 'evolution_chains',
    columns: { id: int('id'), baby_trigger_item_id: int('baby_trigger_item_id') },
  },
  entity('pokemon_species', 'pokemon_species', {
    generation_id: int('generation_id'),
    evolves_from_species_id: int('evolves_from_species_id'),
    evolution_chain_id: int('evolution_chain_id'),
    gender_rate: int('gender_rate'),
    capture_rate: int('capture_rate'),
    base_happiness: int('base_happiness'),
    is_baby: bool('is_baby'),
    hatch_counter: int('hatch_counter'),
    has_gender_differences: bool('has_gender_differences'),
    growth_rate_id: int('growth_rate_id'),
    forms_switchable: bool('forms_switchable'),
    is_legendary: bool('is_legendary'),
    is_mythical: bool('is_mythical'),
    sort_order: int('order'),
  }),
  {
    csv: 'pokemon_species_names',
    table: 'species_i18n',
    columns: {
      species_id: int('pokemon_species_id'),
      lang: lang(),
      name: str('name'),
      genus: str('genus'),
    },
    required: ['lang', 'name'],
  },
  junction('pokemon_egg_groups', 'pokemon_egg_groups', {
    species_id: 'species_id',
    egg_group_id: 'egg_group_id',
  }),
  junction('pokemon_dex_numbers', 'pokemon_dex_numbers', {
    species_id: 'species_id',
    pokedex_id: 'pokedex_id',
    number: 'pokedex_number',
  }),
  entity('pokemon', 'pokemon', {
    species_id: int('species_id'),
    is_default: bool('is_default'),
    height_dm: int('height'),
    weight_hg: int('weight'),
    base_experience: int('base_experience'),
    sort_order: int('order'),
  }),
  entity('pokemon_forms', 'pokemon_forms', {
    pokemon_id: int('pokemon_id'),
    form_identifier: str('form_identifier'),
    introduced_in_version_group_id: int('introduced_in_version_group_id'),
    is_default: bool('is_default'),
    is_battle_only: bool('is_battle_only'),
    is_mega: bool('is_mega'),
    form_order: int('form_order'),
    sort_order: int('order'),
  }),
  {
    csv: 'pokemon_form_names',
    table: 'form_i18n',
    columns: {
      form_id: int('pokemon_form_id'),
      lang: lang(),
      form_name: str('form_name'),
      pokemon_name: str('pokemon_name'),
    },
    required: ['lang'],
  },
  junction('pokemon_form_types', 'pokemon_form_types', {
    form_id: 'pokemon_form_id',
    slot: 'slot',
    type_id: 'type_id',
  }),
  entity('evolution_triggers', 'evolution_triggers'),
  names(
    'evolution_trigger_prose',
    'evolution_trigger_i18n',
    'evolution_trigger_id',
    'evolution_trigger_id',
  ),
  {
    csv: 'pokemon_evolution',
    table: 'pokemon_evolution',
    columns: {
      id: int('id'),
      evolved_species_id: int('evolved_species_id'),
      trigger_id: int('evolution_trigger_id'),
      version_group_id: int('version_group_id'),
      is_default: bool('is_default'),
      trigger_item_id: int('trigger_item_id'),
      min_level: int('minimum_level'),
      gender_id: int('gender_id'),
      location_id: int('location_id'),
      held_item_id: int('held_item_id'),
      time_of_day: str('time_of_day'),
      known_move_id: int('known_move_id'),
      known_move_type_id: int('known_move_type_id'),
      min_happiness: int('minimum_happiness'),
      min_beauty: int('minimum_beauty'),
      min_affection: int('minimum_affection'),
      relative_physical_stats: int('relative_physical_stats'),
      party_species_id: int('party_species_id'),
      party_type_id: int('party_type_id'),
      trade_species_id: int('trade_species_id'),
      needs_overworld_rain: bool('needs_overworld_rain'),
      turn_upside_down: bool('turn_upside_down'),
      needs_multiplayer: bool('needs_multiplayer'),
      near_special_rock: bool('near_special_rock'),
      region_id: int('region_id'),
      required_form_id: int('required_pokemon_form_id'),
      evolved_form_id: int('evolved_pokemon_form_id'),
      used_move_id: int('used_move_id'),
      min_move_count: int('minimum_move_count'),
      min_steps: int('minimum_steps'),
      min_damage_taken: int('minimum_damage_taken'),
      nature_bitmask: int('nature_bitmask'),
      condition_expression: str('condition_expression'),
      percentage_chance: int('percentage_chance'),
    },
  },

  // Moves
  entity('move_damage_classes', 'move_damage_classes'),
  described(
    'move_damage_class_prose',
    'move_damage_class_i18n',
    'damage_class_id',
    'move_damage_class_id',
  ),
  entity('move_targets', 'move_targets'),
  described('move_target_prose', 'move_target_i18n', 'target_id', 'move_target_id'),
  entity('pokemon_move_methods', 'move_learn_methods'),
  described(
    'pokemon_move_method_prose',
    'move_learn_method_i18n',
    'method_id',
    'pokemon_move_method_id',
  ),
  { csv: 'move_effects', table: 'move_effects', columns: { id: int('id') } },
  prose('move_effect_prose', 'move_effect_i18n', 'effect_id', 'move_effect_id'),
  entity('move_meta_categories', 'move_meta_categories'),
  {
    csv: 'move_meta_category_prose',
    table: 'move_meta_category_i18n',
    columns: {
      category_id: int('move_meta_category_id'),
      lang: lang(),
      description: str('description'),
    },
    required: ['lang', 'description'],
  },
  entity('move_meta_ailments', 'move_meta_ailments'),
  names('move_meta_ailment_names', 'move_meta_ailment_i18n', 'ailment_id', 'move_meta_ailment_id'),
  entity('move_flags', 'move_flags'),
  described('move_flag_prose', 'move_flag_i18n', 'flag_id', 'move_flag_id'),
  entity('moves', 'moves', { generation_id: int('generation_id') }),
  names('move_names', 'move_i18n', 'move_id', 'move_id'),
  {
    csv: 'move_meta',
    table: 'move_meta',
    columns: {
      move_id: int('move_id'),
      category_id: int('meta_category_id'),
      ailment_id: int('meta_ailment_id'),
      min_hits: int('min_hits'),
      max_hits: int('max_hits'),
      min_turns: int('min_turns'),
      max_turns: int('max_turns'),
      drain: int('drain'),
      healing: int('healing'),
      crit_rate: int('crit_rate'),
      ailment_chance: int('ailment_chance'),
      flinch_chance: int('flinch_chance'),
      stat_chance: int('stat_chance'),
    },
  },
  junction('move_meta_stat_changes', 'move_meta_stat_changes', {
    move_id: 'move_id',
    stat_id: 'stat_id',
    change: 'change',
  }),
  junction('move_flag_map', 'move_flag_map', { move_id: 'move_id', flag_id: 'move_flag_id' }),
  {
    ...junction('machines', 'machines', {
      machine_number: 'machine_number',
      version_group_id: 'version_group_id',
      item_id: 'item_id',
      move_id: 'move_id',
    }),
    orIgnore: true,
  },

  // Abilities
  entity('abilities', 'abilities', {
    generation_id: int('generation_id'),
    is_main_series: bool('is_main_series'),
  }),
  names('ability_names', 'ability_i18n', 'ability_id', 'ability_id'),
  prose('ability_prose', 'ability_prose_i18n', 'ability_id', 'ability_id'),

  // Items
  entity('item_pockets', 'item_pockets'),
  names('item_pocket_names', 'item_pocket_i18n', 'pocket_id', 'item_pocket_id'),
  entity('item_categories', 'item_categories', { pocket_id: int('pocket_id') }),
  names('item_category_prose', 'item_category_i18n', 'category_id', 'item_category_id'),
  entity('item_fling_effects', 'item_fling_effects'),
  {
    csv: 'item_fling_effect_prose',
    table: 'item_fling_effect_i18n',
    columns: {
      fling_effect_id: int('item_fling_effect_id'),
      lang: lang(),
      effect: str('effect'),
    },
    required: ['lang', 'effect'],
  },
  entity('item_flags', 'item_flags'),
  described('item_flag_prose', 'item_flag_i18n', 'flag_id', 'item_flag_id'),
  entity('items', 'items', {
    category_id: int('category_id'),
    cost: int('cost'),
    fling_power: int('fling_power'),
    fling_effect_id: int('fling_effect_id'),
  }),
  names('item_names', 'item_i18n', 'item_id', 'item_id'),
  prose('item_prose', 'item_prose_i18n', 'item_id', 'item_id'),
  junction('item_flag_map', 'item_flag_map', { item_id: 'item_id', flag_id: 'item_flag_id' }),
  {
    ...junction('item_game_indices', 'item_generations', {
      item_id: 'item_id',
      generation_id: 'generation_id',
    }),
    orIgnore: true,
  },
  entity('berry_firmness', 'berry_firmness'),
  names('berry_firmness_names', 'berry_firmness_i18n', 'firmness_id', 'berry_firmness_id'),
  junction('berries', 'berries', {
    id: 'id',
    item_id: 'item_id',
    firmness_id: 'firmness_id',
    natural_gift_power: 'natural_gift_power',
    natural_gift_type_id: 'natural_gift_type_id',
    size: 'size',
    max_harvest: 'max_harvest',
    growth_time: 'growth_time',
    soil_dryness: 'soil_dryness',
    smoothness: 'smoothness',
  }),
  junction('berry_flavors', 'berry_flavor_map', {
    berry_id: 'berry_id',
    flavor_id: 'contest_type_id',
    potency: 'flavor',
  }),

  // Locations
  entity('locations', 'locations', { region_id: int('region_id') }),
  {
    csv: 'location_names',
    table: 'location_i18n',
    columns: {
      location_id: int('location_id'),
      lang: lang(),
      name: str('name'),
      subtitle: str('subtitle'),
    },
    required: ['lang', 'name'],
  },
  {
    // A location can have several game indices in one generation.
    ...junction('location_game_indices', 'location_generations', {
      location_id: 'location_id',
      generation_id: 'generation_id',
    }),
    orIgnore: true,
  },
  {
    csv: 'location_areas',
    table: 'location_areas',
    columns: {
      id: int('id'),
      location_id: int('location_id'),
      game_index: int('game_index'),
      identifier: str('identifier'),
    },
  },
  names('location_area_prose', 'location_area_i18n', 'location_area_id', 'location_area_id'),
  entity('encounter_methods', 'encounter_methods', { sort_order: int('order') }),
  names('encounter_method_prose', 'encounter_method_i18n', 'method_id', 'encounter_method_id'),
  {
    csv: 'encounter_slots',
    table: 'encounter_slots',
    columns: {
      id: int('id'),
      version_group_id: int('version_group_id'),
      method_id: int('encounter_method_id'),
      slot: int('slot'),
      rarity: int('rarity'),
    },
  },
  entity('encounter_conditions', 'encounter_conditions'),
  names(
    'encounter_condition_prose',
    'encounter_condition_i18n',
    'condition_id',
    'encounter_condition_id',
  ),
  entity('encounter_condition_values', 'encounter_condition_values', {
    condition_id: int('encounter_condition_id'),
    is_default: bool('is_default'),
  }),
  names(
    'encounter_condition_value_prose',
    'encounter_condition_value_i18n',
    'condition_value_id',
    'encounter_condition_value_id',
  ),
  junction('encounter_condition_value_map', 'encounter_condition_value_map', {
    encounter_id: 'encounter_id',
    condition_value_id: 'encounter_condition_value_id',
  }),
];
