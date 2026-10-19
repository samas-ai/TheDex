import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generations, languages, versionGroups } from './core';
import { describedNameTable, nameTable, proseTable } from './helpers';
import { items } from './items';
import { stats, types } from './misc';
import { pokemon } from './pokemon';

export const moveDamageClasses = sqliteTable('move_damage_classes', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
});
export const moveDamageClassI18n = describedNameTable(
  'move_damage_class_i18n',
  'damage_class_id',
  () => moveDamageClasses.id,
);

export const moveTargets = sqliteTable('move_targets', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
});
export const moveTargetI18n = describedNameTable(
  'move_target_i18n',
  'target_id',
  () => moveTargets.id,
);

export const moveLearnMethods = sqliteTable('move_learn_methods', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
});
export const moveLearnMethodI18n = describedNameTable(
  'move_learn_method_i18n',
  'method_id',
  () => moveLearnMethods.id,
);

export const moveEffects = sqliteTable('move_effects', {
  id: integer('id').primaryKey(),
});
/** Effect prose; `$effect_chance` placeholders are substituted by the UI. */
export const moveEffectI18n = proseTable('move_effect_i18n', 'effect_id', () => moveEffects.id);

export const moveMetaCategories = sqliteTable('move_meta_categories', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
});
export const moveMetaCategoryI18n = sqliteTable(
  'move_meta_category_i18n',
  {
    categoryId: integer('category_id')
      .notNull()
      .references(() => moveMetaCategories.id),
    lang: text('lang')
      .notNull()
      .references(() => languages.code),
    description: text('description').notNull(),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.lang] })],
);

export const moveMetaAilments = sqliteTable('move_meta_ailments', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
});
export const moveMetaAilmentI18n = nameTable(
  'move_meta_ailment_i18n',
  'ailment_id',
  () => moveMetaAilments.id,
);

export const moveFlags = sqliteTable('move_flags', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull().unique(),
});
export const moveFlagI18n = describedNameTable('move_flag_i18n', 'flag_id', () => moveFlags.id);

export const moves = sqliteTable(
  'moves',
  {
    id: integer('id').primaryKey(),
    identifier: text('identifier').notNull(),
    psId: text('ps_id'),
    /** Pokémon Showdown display name (e.g. `U-turn`), for team export (RF08.4). */
    psName: text('ps_name'),
    generationId: integer('generation_id')
      .notNull()
      .references(() => generations.id),
    /** null | z | max | gmax */
    variantKind: text('variant_kind'),
    /** Z-Move base power when this move is used as Z (from @pkmn/dex; per-move exceptions). */
    zPower: integer('z_power'),
    /** Z-Move effect for status moves (e.g. `clearnegativeboost`, `heal`). */
    zEffect: text('z_effect'),
    /** Z-Move stat boosts for status moves, JSON keyed by stat identifier (`{"speed":1}`). */
    zBoosts: text('z_boosts'),
    /** Max Move base power when this move is used as Max. */
    maxPower: integer('max_power'),
  },
  (t) => [index('moves_ps_id_idx').on(t.psId)],
);
export const moveI18n = nameTable('move_i18n', 'move_id', () => moves.id);

/** Materialized per-version-group stats (resolves PokeAPI move_changelog + Gen 1-3 split). */
export const moveStatsByVg = sqliteTable(
  'move_stats_by_vg',
  {
    moveId: integer('move_id')
      .notNull()
      .references(() => moves.id),
    versionGroupId: integer('version_group_id')
      .notNull()
      .references(() => versionGroups.id),
    typeId: integer('type_id')
      .notNull()
      .references(() => types.id),
    power: integer('power'),
    pp: integer('pp'),
    accuracy: integer('accuracy'),
    priority: integer('priority').notNull(),
    damageClassId: integer('damage_class_id')
      .notNull()
      .references(() => moveDamageClasses.id),
    targetId: integer('target_id')
      .notNull()
      .references(() => moveTargets.id),
    effectId: integer('effect_id').references(() => moveEffects.id),
    effectChance: integer('effect_chance'),
  },
  (t) => [
    primaryKey({ columns: [t.moveId, t.versionGroupId] }),
    index('move_stats_by_vg_filter_idx').on(t.versionGroupId, t.typeId, t.damageClassId),
  ],
);

export const moveMeta = sqliteTable('move_meta', {
  moveId: integer('move_id')
    .primaryKey()
    .references(() => moves.id),
  categoryId: integer('category_id').references(() => moveMetaCategories.id),
  ailmentId: integer('ailment_id').references(() => moveMetaAilments.id),
  minHits: integer('min_hits'),
  maxHits: integer('max_hits'),
  minTurns: integer('min_turns'),
  maxTurns: integer('max_turns'),
  drain: integer('drain'),
  healing: integer('healing'),
  critRate: integer('crit_rate'),
  ailmentChance: integer('ailment_chance'),
  flinchChance: integer('flinch_chance'),
  statChance: integer('stat_chance'),
});

export const moveMetaStatChanges = sqliteTable(
  'move_meta_stat_changes',
  {
    moveId: integer('move_id')
      .notNull()
      .references(() => moves.id),
    statId: integer('stat_id')
      .notNull()
      .references(() => stats.id),
    change: integer('change').notNull(),
  },
  (t) => [primaryKey({ columns: [t.moveId, t.statId] })],
);

export const moveFlagMap = sqliteTable(
  'move_flag_map',
  {
    moveId: integer('move_id')
      .notNull()
      .references(() => moves.id),
    flagId: integer('flag_id')
      .notNull()
      .references(() => moveFlags.id),
  },
  (t) => [
    primaryKey({ columns: [t.moveId, t.flagId] }),
    index('move_flag_map_flag_idx').on(t.flagId, t.moveId),
  ],
);

/** Z / Max / G-Max relationships (RF03.4). */
export const moveVariants = sqliteTable(
  'move_variants',
  {
    id: integer('id').primaryKey(),
    variantMoveId: integer('variant_move_id')
      .notNull()
      .references(() => moves.id),
    /** z | z_signature | max | gmax */
    kind: text('kind').notNull(),
    baseMoveId: integer('base_move_id').references(() => moves.id),
    requiredItemId: integer('required_item_id').references(() => items.id),
    pokemonId: integer('pokemon_id').references(() => pokemon.id),
  },
  (t) => [
    index('move_variants_variant_idx').on(t.variantMoveId),
    index('move_variants_base_idx').on(t.baseMoveId),
  ],
);

/**
 * G-Max Moves (RF03.4). PokeAPI has none, so they come from @pkmn/dex with their English
 * name and description; each replaces the Max Move of its type for one Gigantamax variety.
 */
export const gmaxMoves = sqliteTable('gmax_moves', {
  psId: text('ps_id').primaryKey(),
  name: text('name').notNull(),
  typeId: integer('type_id')
    .notNull()
    .references(() => types.id),
  pokemonId: integer('pokemon_id').references(() => pokemon.id),
  /** Fixed base power (G-Max Drum Solo, Fireball, Hydrosnipe); null = from the base move. */
  power: integer('power'),
  description: text('description'),
});

/** Learnsets — the largest table. */
export const pokemonMoves = sqliteTable(
  'pokemon_moves',
  {
    pokemonId: integer('pokemon_id')
      .notNull()
      .references(() => pokemon.id),
    versionGroupId: integer('version_group_id')
      .notNull()
      .references(() => versionGroups.id),
    methodId: integer('method_id')
      .notNull()
      .references(() => moveLearnMethods.id),
    moveId: integer('move_id')
      .notNull()
      .references(() => moves.id),
    level: integer('level').notNull(),
    /** Legends: Arceus mastery level. */
    mastery: integer('mastery'),
    sortOrder: integer('sort_order'),
  },
  (t) => [
    primaryKey({
      columns: [t.pokemonId, t.versionGroupId, t.methodId, t.moveId, t.level],
    }),
    index('pokemon_moves_move_idx').on(t.moveId, t.versionGroupId),
  ],
);

/** TM/HM/TR labels per version group. */
export const machines = sqliteTable(
  'machines',
  {
    machineNumber: integer('machine_number').notNull(),
    versionGroupId: integer('version_group_id')
      .notNull()
      .references(() => versionGroups.id),
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    moveId: integer('move_id')
      .notNull()
      .references(() => moves.id),
  },
  (t) => [
    primaryKey({ columns: [t.versionGroupId, t.itemId] }),
    index('machines_move_idx').on(t.moveId, t.versionGroupId),
  ],
);
