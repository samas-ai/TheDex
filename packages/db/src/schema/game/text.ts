import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { abilities } from './abilities';
import { languages, versionGroups, versions } from './core';
import { items } from './items';
import { moves } from './moves';
import { pokemonSpecies } from './pokemon';

/**
 * Deduplicated flavor texts. The same sentence repeats across versions (and across
 * languages: es-419 reuses es), so every `*_flavor_text` table points here instead of
 * storing the text again. The language lives on the referencing row.
 */
export const flavorTexts = sqliteTable('flavor_texts', {
  id: integer('id').primaryKey(),
  text: text('text').notNull(),
});

/** Pokédex entries per version (RF02.2). */
export const speciesFlavorText = sqliteTable(
  'species_flavor_text',
  {
    speciesId: integer('species_id')
      .notNull()
      .references(() => pokemonSpecies.id),
    versionId: integer('version_id')
      .notNull()
      .references(() => versions.id),
    lang: text('lang')
      .notNull()
      .references(() => languages.code),
    flavorTextId: integer('flavor_text_id')
      .notNull()
      .references(() => flavorTexts.id),
  },
  (t) => [primaryKey({ columns: [t.speciesId, t.versionId, t.lang] })],
);

export const moveFlavorText = sqliteTable(
  'move_flavor_text',
  {
    moveId: integer('move_id')
      .notNull()
      .references(() => moves.id),
    versionGroupId: integer('version_group_id')
      .notNull()
      .references(() => versionGroups.id),
    lang: text('lang')
      .notNull()
      .references(() => languages.code),
    flavorTextId: integer('flavor_text_id')
      .notNull()
      .references(() => flavorTexts.id),
  },
  (t) => [primaryKey({ columns: [t.moveId, t.versionGroupId, t.lang] })],
);

export const abilityFlavorText = sqliteTable(
  'ability_flavor_text',
  {
    abilityId: integer('ability_id')
      .notNull()
      .references(() => abilities.id),
    versionGroupId: integer('version_group_id')
      .notNull()
      .references(() => versionGroups.id),
    lang: text('lang')
      .notNull()
      .references(() => languages.code),
    flavorTextId: integer('flavor_text_id')
      .notNull()
      .references(() => flavorTexts.id),
  },
  (t) => [primaryKey({ columns: [t.abilityId, t.versionGroupId, t.lang] })],
);

export const itemFlavorText = sqliteTable(
  'item_flavor_text',
  {
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id),
    versionGroupId: integer('version_group_id')
      .notNull()
      .references(() => versionGroups.id),
    lang: text('lang')
      .notNull()
      .references(() => languages.code),
    flavorTextId: integer('flavor_text_id')
      .notNull()
      .references(() => flavorTexts.id),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.versionGroupId, t.lang] })],
);
