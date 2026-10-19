import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { generations, languages } from './core';
import { nameTable } from './helpers';

export const abilities = sqliteTable('abilities', {
  id: integer('id').primaryKey(),
  identifier: text('identifier').notNull(),
  psId: text('ps_id'),
  /** Pokémon Showdown display name (e.g. `Rough Skin`), for team export (RF08.4). */
  psName: text('ps_name'),
  generationId: integer('generation_id')
    .notNull()
    .references(() => generations.id),
  isMainSeries: integer('is_main_series', { mode: 'boolean' }).notNull(),
});
export const abilityI18n = nameTable('ability_i18n', 'ability_id', () => abilities.id);

export const abilityProseI18n = sqliteTable(
  'ability_prose_i18n',
  {
    abilityId: integer('ability_id')
      .notNull()
      .references(() => abilities.id),
    lang: text('lang')
      .notNull()
      .references(() => languages.code),
    shortEffect: text('short_effect'),
    effect: text('effect'),
    /** Effect outside battle (RF04.1) — curated, not provided by PokeAPI. */
    overworldEffect: text('overworld_effect'),
  },
  (t) => [primaryKey({ columns: [t.abilityId, t.lang] })],
);
