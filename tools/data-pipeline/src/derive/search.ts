import { ALIAS_LANG, normalizeSearchText, type SearchEntityType } from '@thedex/db';
import { SEARCH_FTS_TABLE } from '@thedex/db/game';
import type { BuildContext } from '../context';
import type { SqlValue } from '../values';

interface NameRow {
  entity_id: number;
  lang: string;
  name: string;
  priority: number;
  sort_key: number;
}

/** Name sources per entity type. `priority` 0 = canonical entry, 1 = alternate variety. */
const SOURCES: Readonly<Record<SearchEntityType, string>> = {
  // Default varieties are found by species name; alternate varieties (Mega Charizard X,
  // Alolan Raichu…) by their form's full name.
  pokemon: `
    SELECT p.id AS entity_id, si.lang, si.name, 0 AS priority, p.species_id * 100000 AS sort_key
    FROM pokemon p JOIN species_i18n si ON si.species_id = p.species_id
    WHERE p.is_default = 1
    UNION ALL
    SELECT p.id, fi.lang, fi.pokemon_name, 1, p.species_id * 100000 + p.id
    FROM pokemon p
    JOIN pokemon_forms f ON f.pokemon_id = p.id AND f.is_default = 1
    JOIN form_i18n fi ON fi.form_id = f.id
    WHERE p.is_default = 0 AND fi.pokemon_name IS NOT NULL`,
  move: `SELECT move_id AS entity_id, lang, name, 0 AS priority, move_id AS sort_key FROM move_i18n`,
  ability: `
    SELECT ai.ability_id AS entity_id, ai.lang, ai.name, 0 AS priority, ai.ability_id AS sort_key
    FROM ability_i18n ai JOIN abilities a ON a.id = ai.ability_id WHERE a.is_main_series = 1`,
  item: `SELECT item_id AS entity_id, lang, name, 0 AS priority, item_id AS sort_key FROM item_i18n`,
  location: `
    SELECT location_id AS entity_id, lang, name, 0 AS priority, location_id AS sort_key
    FROM location_i18n`,
  nature: `SELECT nature_id AS entity_id, lang, name, 0 AS priority, nature_id AS sort_key FROM nature_i18n`,
  type: `
    SELECT type_id AS entity_id, lang, name, 0 AS priority, type_id AS sort_key
    FROM type_i18n WHERE type_id < 10000`,
};

/** Alias sources: Showdown IDs (`hooh`, `charizardmegax`…). */
const ALIAS_SOURCES: Partial<Record<SearchEntityType, string>> = {
  pokemon: `SELECT id AS entity_id, ps_id AS name, CASE WHEN is_default = 1 THEN 0 ELSE 1 END AS priority,
              species_id * 100000 + CASE WHEN is_default = 1 THEN 0 ELSE id END AS sort_key
            FROM pokemon WHERE ps_id IS NOT NULL`,
  move: `SELECT id AS entity_id, ps_id AS name, 0 AS priority, id AS sort_key FROM moves WHERE ps_id IS NOT NULL`,
  ability: `SELECT id AS entity_id, ps_id AS name, 0 AS priority, id AS sort_key FROM abilities
            WHERE ps_id IS NOT NULL AND is_main_series = 1`,
  item: `SELECT id AS entity_id, ps_id AS name, 0 AS priority, id AS sort_key FROM items WHERE ps_id IS NOT NULL`,
};

const ENTITY_TABLES: Partial<Record<SearchEntityType, string>> = {
  pokemon: 'pokemon',
  move: 'moves',
  ability: 'abilities',
  item: 'items',
};

/** Builds search_terms (names in every language + aliases) and the FTS5 trigram index. */
export function deriveSearch(ctx: BuildContext): void {
  const rows: SqlValue[][] = [];
  const seen = new Set<string>();
  const add = (type: SearchEntityType, row: NameRow) => {
    const norm = normalizeSearchText(row.name);
    if (norm === '') return;
    const key = `${type}:${row.entity_id}:${row.lang}:${norm}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push([type, row.entity_id, row.lang, row.name, norm, row.priority, row.sort_key]);
  };

  for (const [type, query] of Object.entries(SOURCES) as [SearchEntityType, string][]) {
    for (const row of ctx.all<NameRow>(query)) add(type, row);
  }
  for (const [type, query] of Object.entries(ALIAS_SOURCES) as [SearchEntityType, string][]) {
    for (const row of ctx.all<Omit<NameRow, 'lang'>>(query))
      add(type, { ...row, lang: ALIAS_LANG });
  }

  // Curated aliases (keys are PokeAPI identifiers).
  for (const [type, aliases] of Object.entries(ctx.curated.searchAliases)) {
    const table = ENTITY_TABLES[type as SearchEntityType];
    if (!table) continue;
    const ids = new Map(
      ctx
        .all<{ id: number; identifier: string }>(`SELECT id, identifier FROM "${table}"`)
        .map((row) => [row.identifier, row.id]),
    );
    for (const [identifier, names] of Object.entries(aliases)) {
      const id = ids.get(identifier);
      if (id === undefined) continue;
      for (const name of names) {
        add(type as SearchEntityType, {
          entity_id: id,
          lang: ALIAS_LANG,
          name,
          priority: 0,
          sort_key: id,
        });
      }
    }
  }

  ctx.insert(
    'search_terms',
    ['entity_type', 'entity_id', 'lang', 'name', 'name_norm', 'priority', 'sort_key'],
    rows,
  );
  ctx.db.exec(`
    CREATE VIRTUAL TABLE "${SEARCH_FTS_TABLE}" USING fts5(
      name_norm, content='search_terms', content_rowid='id', tokenize='trigram'
    );
    INSERT INTO "${SEARCH_FTS_TABLE}"("${SEARCH_FTS_TABLE}") VALUES ('rebuild');`);
  ctx.log(`  search_terms: ${rows.length} (+ ${SEARCH_FTS_TABLE} trigram index)`);
}
