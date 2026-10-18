import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import { languages } from './core';

/**
 * `<entity>_i18n(<entity>_id, lang, name)` — the standard translated-name table.
 * Rows are small, so these tables are created WITHOUT ROWID (see WITHOUT_ROWID_TABLES).
 */
export function nameTable(tableName: string, idColumn: string, ref: () => AnySQLiteColumn) {
  return sqliteTable(
    tableName,
    {
      entityId: integer(idColumn).notNull().references(ref),
      lang: text('lang')
        .notNull()
        .references(() => languages.code),
      name: text('name').notNull(),
    },
    (t) => [primaryKey({ columns: [t.entityId, t.lang] })],
  );
}

/** `<entity>_i18n(<entity>_id, lang, name, description)` — names with a longer description. */
export function describedNameTable(
  tableName: string,
  idColumn: string,
  ref: () => AnySQLiteColumn,
) {
  return sqliteTable(
    tableName,
    {
      entityId: integer(idColumn).notNull().references(ref),
      lang: text('lang')
        .notNull()
        .references(() => languages.code),
      name: text('name').notNull(),
      description: text('description'),
    },
    (t) => [primaryKey({ columns: [t.entityId, t.lang] })],
  );
}

/** `<entity>_i18n(<entity>_id, lang, short_effect, effect)` — long effect prose. */
export function proseTable(tableName: string, idColumn: string, ref: () => AnySQLiteColumn) {
  return sqliteTable(
    tableName,
    {
      entityId: integer(idColumn).notNull().references(ref),
      lang: text('lang')
        .notNull()
        .references(() => languages.code),
      shortEffect: text('short_effect'),
      effect: text('effect'),
    },
    (t) => [primaryKey({ columns: [t.entityId, t.lang] })],
  );
}
