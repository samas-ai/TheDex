import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { abilities } from './abilities';
import { games, generations, languages, pokedexes, regions, versionGroups } from './core';
import { nameTable } from './helpers';
import { items } from './items';
import { locations } from './locations';
import { types } from './misc';
import { moves } from './moves';

export const growthRates = sqliteTable('growth_rates', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
  /** LaTeX formula as published by PokeAPI (display only; the engine computes XP). */
  formula: text('formula'),
});
export const growthRateI18n = nameTable('growth_rate_i18n', 'growth_rate_id', () => growthRates.id);

export const eggGroups = sqliteTable('egg_groups', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
});
export const eggGroupI18n = nameTable('egg_group_i18n', 'egg_group_id', () => eggGroups.id);

export const evolutionChains = sqliteTable('evolution_chains', {
  id: integer('id').primaryKey(),
  babyTriggerItemId: integer('baby_trigger_item_id').references(() => items.id),
});

export const pokemonSpecies = sqliteTable(
  'pokemon_species',
  {
    id: integer('id').primaryKey(),
    identifier: text('identifier').notNull(),
    generationId: integer('generation_id')
      .notNull()
      .references(() => generations.id),
    evolvesFromSpeciesId: integer('evolves_from_species_id'),
    evolutionChainId: integer('evolution_chain_id').references(() => evolutionChains.id),
    /** Chance of being female in eighths; -1 = genderless. */
    genderRate: integer('gender_rate').notNull(),
    captureRate: integer('capture_rate').notNull(),
    baseHappiness: integer('base_happiness'),
    isBaby: integer('is_baby', { mode: 'boolean' }).notNull(),
    hatchCounter: integer('hatch_counter'),
    hasGenderDifferences: integer('has_gender_differences', { mode: 'boolean' }).notNull(),
    growthRateId: integer('growth_rate_id')
      .notNull()
      .references(() => growthRates.id),
    formsSwitchable: integer('forms_switchable', { mode: 'boolean' }).notNull(),
    isLegendary: integer('is_legendary', { mode: 'boolean' }).notNull(),
    isMythical: integer('is_mythical', { mode: 'boolean' }).notNull(),
    sortOrder: integer('sort_order'),
  },
  (t) => [index('pokemon_species_chain_idx').on(t.evolutionChainId)],
);

export const speciesI18n = sqliteTable(
  'species_i18n',
  {
    speciesId: integer('species_id')
      .notNull()
      .references(() => pokemonSpecies.id),
    lang: text('lang')
      .notNull()
      .references(() => languages.code),
    name: text('name').notNull(),
    /** e.g. "Seed Pokémon". */
    genus: text('genus'),
  },
  (t) => [primaryKey({ columns: [t.speciesId, t.lang] })],
);

/** starter | legendary | mythical | ultra_beast | paradox | baby | fossil */
export const speciesTags = sqliteTable(
  'species_tags',
  {
    speciesId: integer('species_id')
      .notNull()
      .references(() => pokemonSpecies.id),
    tag: text('tag').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.speciesId, t.tag] }),
    index('species_tags_tag_idx').on(t.tag, t.speciesId),
  ],
);

export const pokemonEggGroups = sqliteTable(
  'pokemon_egg_groups',
  {
    speciesId: integer('species_id')
      .notNull()
      .references(() => pokemonSpecies.id),
    eggGroupId: integer('egg_group_id')
      .notNull()
      .references(() => eggGroups.id),
  },
  (t) => [
    primaryKey({ columns: [t.speciesId, t.eggGroupId] }),
    index('pokemon_egg_groups_group_idx').on(t.eggGroupId, t.speciesId),
  ],
);

export const pokemonDexNumbers = sqliteTable(
  'pokemon_dex_numbers',
  {
    speciesId: integer('species_id')
      .notNull()
      .references(() => pokemonSpecies.id),
    pokedexId: integer('pokedex_id')
      .notNull()
      .references(() => pokedexes.id),
    number: integer('number').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.speciesId, t.pokedexId] }),
    index('pokemon_dex_numbers_dex_idx').on(t.pokedexId, t.number),
  ],
);

/** A battle-relevant variety with its own stats (Charizard, Mega Charizard X, Alolan Raichu…). */
export const pokemon = sqliteTable(
  'pokemon',
  {
    id: integer('id').primaryKey(),
    identifier: text('identifier').notNull(),
    /** Pokémon Showdown ID (e.g. `charizardmegax`), null when unmapped. */
    psId: text('ps_id'),
    speciesId: integer('species_id')
      .notNull()
      .references(() => pokemonSpecies.id),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull(),
    heightDm: integer('height_dm').notNull(),
    weightHg: integer('weight_hg').notNull(),
    baseExperience: integer('base_experience'),
    sortOrder: integer('sort_order'),
  },
  (t) => [
    index('pokemon_species_idx').on(t.speciesId),
    index('pokemon_height_idx').on(t.heightDm),
    index('pokemon_weight_idx').on(t.weightHg),
    index('pokemon_ps_id_idx').on(t.psId),
  ],
);

/** Forms, including cosmetic ones sharing a pokemon_id (Unown, Vivillon, Alcremie…). */
export const pokemonForms = sqliteTable(
  'pokemon_forms',
  {
    id: integer('id').primaryKey(),
    identifier: text('identifier').notNull(),
    psId: text('ps_id'),
    pokemonId: integer('pokemon_id')
      .notNull()
      .references(() => pokemon.id),
    formIdentifier: text('form_identifier'),
    /** default | mega | gmax | regional_* | weather | item | cosmetic | other (Phase 2). */
    formKind: text('form_kind'),
    introducedInVersionGroupId: integer('introduced_in_version_group_id').references(
      () => versionGroups.id,
    ),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull(),
    isBattleOnly: integer('is_battle_only', { mode: 'boolean' }).notNull(),
    isMega: integer('is_mega', { mode: 'boolean' }).notNull(),
    formOrder: integer('form_order'),
    sortOrder: integer('sort_order'),
  },
  (t) => [index('pokemon_forms_pokemon_idx').on(t.pokemonId)],
);

export const formI18n = sqliteTable(
  'form_i18n',
  {
    formId: integer('form_id')
      .notNull()
      .references(() => pokemonForms.id),
    lang: text('lang')
      .notNull()
      .references(() => languages.code),
    /** e.g. "Mega X". */
    formName: text('form_name'),
    /** e.g. "Mega Charizard X". */
    pokemonName: text('pokemon_name'),
  },
  (t) => [primaryKey({ columns: [t.formId, t.lang] })],
);

/** Form-level typing (Arceus plates, Silvally memories) when it differs from the pokemon. */
export const pokemonFormTypes = sqliteTable(
  'pokemon_form_types',
  {
    formId: integer('form_id')
      .notNull()
      .references(() => pokemonForms.id),
    slot: integer('slot').notNull(),
    typeId: integer('type_id')
      .notNull()
      .references(() => types.id),
  },
  (t) => [primaryKey({ columns: [t.formId, t.slot] })],
);

/** How one variety turns into another (mega, primal, gmax, item/move/ability forms). */
export const formChanges = sqliteTable(
  'form_changes',
  {
    fromPokemonId: integer('from_pokemon_id')
      .notNull()
      .references(() => pokemon.id),
    toPokemonId: integer('to_pokemon_id')
      .notNull()
      .references(() => pokemon.id),
    /** mega | primal | gmax | battle | item | move | ability | other */
    kind: text('kind').notNull(),
    itemId: integer('item_id').references(() => items.id),
    moveId: integer('move_id').references(() => moves.id),
    abilityId: integer('ability_id').references(() => abilities.id),
  },
  (t) => [
    primaryKey({ columns: [t.fromPokemonId, t.toPokemonId] }),
    index('form_changes_to_idx').on(t.toPokemonId),
  ],
);

// --- Materialized per-generation history (built from PokeAPI *_past tables) -------------

export const pokemonTypesByGen = sqliteTable(
  'pokemon_types_by_gen',
  {
    pokemonId: integer('pokemon_id')
      .notNull()
      .references(() => pokemon.id),
    generationId: integer('generation_id')
      .notNull()
      .references(() => generations.id),
    slot: integer('slot').notNull(),
    typeId: integer('type_id')
      .notNull()
      .references(() => types.id),
  },
  (t) => [
    primaryKey({ columns: [t.pokemonId, t.generationId, t.slot] }),
    index('pokemon_types_by_gen_type_idx').on(t.generationId, t.typeId, t.pokemonId),
  ],
);

export const pokemonAbilitiesByGen = sqliteTable(
  'pokemon_abilities_by_gen',
  {
    pokemonId: integer('pokemon_id')
      .notNull()
      .references(() => pokemon.id),
    generationId: integer('generation_id')
      .notNull()
      .references(() => generations.id),
    slot: integer('slot').notNull(),
    abilityId: integer('ability_id')
      .notNull()
      .references(() => abilities.id),
    isHidden: integer('is_hidden', { mode: 'boolean' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.pokemonId, t.generationId, t.slot] }),
    index('pokemon_abilities_by_gen_ability_idx').on(t.generationId, t.abilityId, t.pokemonId),
  ],
);

export const pokemonStatsByGen = sqliteTable(
  'pokemon_stats_by_gen',
  {
    pokemonId: integer('pokemon_id')
      .notNull()
      .references(() => pokemon.id),
    generationId: integer('generation_id')
      .notNull()
      .references(() => generations.id),
    hp: integer('hp').notNull(),
    attack: integer('attack').notNull(),
    defense: integer('defense').notNull(),
    specialAttack: integer('special_attack').notNull(),
    specialDefense: integer('special_defense').notNull(),
    speed: integer('speed').notNull(),
    /** Gen 1 unified Special stat (null in Gen 2+). */
    special: integer('special'),
    /** Base stat total (Gen 1 counts Special once). */
    bst: integer('bst').notNull(),
    evHp: integer('ev_hp').notNull(),
    evAttack: integer('ev_attack').notNull(),
    evDefense: integer('ev_defense').notNull(),
    evSpecialAttack: integer('ev_special_attack').notNull(),
    evSpecialDefense: integer('ev_special_defense').notNull(),
    evSpeed: integer('ev_speed').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.pokemonId, t.generationId] }),
    index('pokemon_stats_by_gen_hp_idx').on(t.generationId, t.hp),
    index('pokemon_stats_by_gen_attack_idx').on(t.generationId, t.attack),
    index('pokemon_stats_by_gen_defense_idx').on(t.generationId, t.defense),
    index('pokemon_stats_by_gen_spa_idx').on(t.generationId, t.specialAttack),
    index('pokemon_stats_by_gen_spd_idx').on(t.generationId, t.specialDefense),
    index('pokemon_stats_by_gen_speed_idx').on(t.generationId, t.speed),
    index('pokemon_stats_by_gen_bst_idx').on(t.generationId, t.bst),
  ],
);

/** Which varieties exist in each curated game, with their regional dex number. */
export const gamePokemon = sqliteTable(
  'game_pokemon',
  {
    gameId: integer('game_id')
      .notNull()
      .references(() => games.id),
    pokemonId: integer('pokemon_id')
      .notNull()
      .references(() => pokemon.id),
    pokedexId: integer('pokedex_id').references(() => pokedexes.id),
    regionalNumber: integer('regional_number'),
  },
  (t) => [
    primaryKey({ columns: [t.gameId, t.pokemonId] }),
    index('game_pokemon_number_idx').on(t.gameId, t.regionalNumber),
  ],
);

// --- Evolution ---------------------------------------------------------------------------

export const evolutionTriggers = sqliteTable('evolution_triggers', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
});
export const evolutionTriggerI18n = nameTable(
  'evolution_trigger_i18n',
  'evolution_trigger_id',
  () => evolutionTriggers.id,
);

/** One row per evolution method (mirrors PokeAPI `pokemon_evolution`). */
export const pokemonEvolution = sqliteTable(
  'pokemon_evolution',
  {
    id: integer('id').primaryKey(),
    evolvedSpeciesId: integer('evolved_species_id')
      .notNull()
      .references(() => pokemonSpecies.id),
    triggerId: integer('trigger_id')
      .notNull()
      .references(() => evolutionTriggers.id),
    /** Method only valid in this version group (null = all). */
    versionGroupId: integer('version_group_id').references(() => versionGroups.id),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull(),
    triggerItemId: integer('trigger_item_id').references(() => items.id),
    minLevel: integer('min_level'),
    /** 1 = female, 2 = male. */
    genderId: integer('gender_id'),
    locationId: integer('location_id').references(() => locations.id),
    heldItemId: integer('held_item_id').references(() => items.id),
    /** day | night | dusk … */
    timeOfDay: text('time_of_day'),
    knownMoveId: integer('known_move_id').references(() => moves.id),
    knownMoveTypeId: integer('known_move_type_id').references(() => types.id),
    minHappiness: integer('min_happiness'),
    minBeauty: integer('min_beauty'),
    minAffection: integer('min_affection'),
    /** 1 = Atk > Def, 0 = Atk = Def, -1 = Atk < Def. */
    relativePhysicalStats: integer('relative_physical_stats'),
    partySpeciesId: integer('party_species_id').references(() => pokemonSpecies.id),
    partyTypeId: integer('party_type_id').references(() => types.id),
    tradeSpeciesId: integer('trade_species_id').references(() => pokemonSpecies.id),
    needsOverworldRain: integer('needs_overworld_rain', { mode: 'boolean' }).notNull(),
    turnUpsideDown: integer('turn_upside_down', { mode: 'boolean' }).notNull(),
    needsMultiplayer: integer('needs_multiplayer', { mode: 'boolean' }).notNull(),
    nearSpecialRock: integer('near_special_rock', { mode: 'boolean' }).notNull(),
    regionId: integer('region_id').references(() => regions.id),
    requiredFormId: integer('required_form_id').references(() => pokemonForms.id),
    evolvedFormId: integer('evolved_form_id').references(() => pokemonForms.id),
    usedMoveId: integer('used_move_id').references(() => moves.id),
    minMoveCount: integer('min_move_count'),
    minSteps: integer('min_steps'),
    minDamageTaken: integer('min_damage_taken'),
    natureBitmask: integer('nature_bitmask'),
    conditionExpression: text('condition_expression'),
    percentageChance: integer('percentage_chance'),
  },
  (t) => [index('pokemon_evolution_species_idx').on(t.evolvedSpeciesId)],
);
