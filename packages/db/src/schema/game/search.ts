import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Entity kinds indexed by the global search, in default display priority order. */
export const SEARCH_ENTITY_TYPES = [
  'pokemon',
  'move',
  'ability',
  'item',
  'location',
  'nature',
  'type',
] as const;
export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

/** Pseudo-language for alias rows (Showdown IDs, curated aliases) — always searched. */
export const ALIAS_LANG = 'x-alias';

/**
 * One searchable name per entity × language (+ aliases). `search_fts` is an external-content
 * FTS5 table over `name_norm` with the trigram tokenizer, created by the pipeline.
 */
export const searchTerms = sqliteTable(
  'search_terms',
  {
    id: integer('id').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id').notNull(),
    lang: text('lang').notNull(),
    name: text('name').notNull(),
    nameNorm: text('name_norm').notNull(),
    /** Lower = shown first among equally ranked matches (default forms before alt forms). */
    priority: integer('priority').notNull(),
    /** Natural order inside an entity type (national number, id…). */
    sortKey: integer('sort_key').notNull(),
  },
  (t) => [
    index('search_terms_lang_norm_idx').on(t.lang, t.nameNorm),
    index('search_terms_entity_idx').on(t.entityType, t.entityId),
  ],
);

export const SEARCH_FTS_TABLE = 'search_fts';
