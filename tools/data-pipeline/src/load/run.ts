import type { BuildContext } from '../context';
import { cleanFlavorText } from '../text';
import { toBool, toInt, toIntRequired, type SqlValue } from '../values';
import { TABLE_SPECS, type TableSpec } from './specs';

function runSpec(ctx: BuildContext, spec: TableSpec): void {
  const columns = Object.keys(spec.columns);
  const getters = Object.values(spec.columns);
  const required = (spec.required ?? []).map((column) => columns.indexOf(column));
  const rows = ctx.csv(spec.csv);
  let skipped = 0;
  function* mapped(): Generator<SqlValue[]> {
    for (const row of rows) {
      const values = getters.map((getter) => getter(row, ctx));
      if (required.some((index) => values[index] === null)) {
        skipped++;
        continue;
      }
      yield values;
    }
  }
  // Translation tables keep the first row when PokeAPI repeats a (id, lang) pair.
  const orIgnore = spec.orIgnore ?? columns.includes('lang');
  const inserted = ctx.insert(spec.table, columns, mapped(), { orIgnore });
  const ignored = rows.length - skipped - inserted;
  const notes = [skipped && `${skipped} skipped`, ignored && `${ignored} duplicates`].filter(
    Boolean,
  );
  ctx.log(`  ${spec.table}: ${inserted}${notes.length ? ` (${notes.join(', ')})` : ''}`);
}

function loadLanguages(ctx: BuildContext): void {
  const rows = ctx
    .csv('languages')
    .map((row) => [
      ctx.languages.code(row.id),
      toIntRequired(row.id),
      row.iso639 ?? '',
      row.iso3166 ?? '',
      toBool(row.official),
      toIntRequired(row.order),
      0,
    ]);
  ctx.insert(
    'languages',
    ['code', 'pokeapi_id', 'iso639', 'iso3166', 'is_official', 'sort_order', 'has_game_data'],
    rows,
  );
}

/** Berry flavors are PokeAPI contest types; the identifier is the English flavor name. */
function loadFlavors(ctx: BuildContext): void {
  const english = new Map(
    ctx
      .csv('contest_type_names')
      .filter((row) => ctx.languages.code(row.local_language_id) === 'en')
      .map((row) => [row.contest_type_id, (row.flavor ?? '').toLowerCase()]),
  );
  const rows = ctx
    .csv('contest_types')
    .map((row) => [toIntRequired(row.id), english.get(row.id ?? '') || (row.identifier ?? '')]);
  ctx.insert('flavors', ['id', 'identifier'], rows);
}

function loadEncounters(ctx: BuildContext): void {
  const slots = new Map(
    ctx
      .csv('encounter_slots')
      .map((row) => [
        row.id,
        { methodId: toInt(row.encounter_method_id), rarity: toInt(row.rarity) },
      ]),
  );
  let orphaned = 0;
  function* rows(): Generator<SqlValue[]> {
    for (const row of ctx.csv('encounters')) {
      const slot = slots.get(row.encounter_slot_id ?? '');
      if (!slot || slot.methodId === null) {
        orphaned++;
        continue;
      }
      yield [
        toIntRequired(row.id),
        toIntRequired(row.version_id),
        toIntRequired(row.location_area_id),
        toIntRequired(row.pokemon_id),
        slot.methodId,
        toInt(row.encounter_slot_id),
        toIntRequired(row.min_level),
        toIntRequired(row.max_level),
        slot.rarity,
        null,
      ];
    }
  }
  const inserted = ctx.insert(
    'encounters',
    [
      'id',
      'version_id',
      'location_area_id',
      'pokemon_id',
      'method_id',
      'slot_id',
      'min_level',
      'max_level',
      'rate_pct',
      'extra_json',
    ],
    rows(),
  );
  ctx.log(`  encounters: ${inserted}${orphaned ? ` (${orphaned} without slot)` : ''}`);
  ctx.release('encounters');
}

function loadLearnsets(ctx: BuildContext): void {
  const source = ctx.csv('pokemon_moves');
  const inserted = ctx.insert(
    'pokemon_moves',
    ['pokemon_id', 'version_group_id', 'method_id', 'move_id', 'level', 'mastery', 'sort_order'],
    (function* () {
      for (const row of source) {
        yield [
          toIntRequired(row.pokemon_id),
          toIntRequired(row.version_group_id),
          toIntRequired(row.pokemon_move_method_id),
          toIntRequired(row.move_id),
          toInt(row.level) ?? 0,
          toInt(row.mastery),
          toInt(row.order),
        ];
      }
    })(),
    { orIgnore: true },
  );
  const duplicates = source.length - inserted;
  ctx.log(`  pokemon_moves: ${inserted}${duplicates ? ` (${duplicates} duplicates)` : ''}`);
  ctx.release('pokemon_moves');
}

interface FlavorSource {
  readonly csv: string;
  readonly table: string;
  readonly idColumn: string;
  readonly csvIdColumn: string;
  readonly scopeColumn: string;
  readonly csvScopeColumn: string;
}

const FLAVOR_SOURCES: readonly FlavorSource[] = [
  {
    csv: 'pokemon_species_flavor_text',
    table: 'species_flavor_text',
    idColumn: 'species_id',
    csvIdColumn: 'species_id',
    scopeColumn: 'version_id',
    csvScopeColumn: 'version_id',
  },
  {
    csv: 'move_flavor_text',
    table: 'move_flavor_text',
    idColumn: 'move_id',
    csvIdColumn: 'move_id',
    scopeColumn: 'version_group_id',
    csvScopeColumn: 'version_group_id',
  },
  {
    csv: 'ability_flavor_text',
    table: 'ability_flavor_text',
    idColumn: 'ability_id',
    csvIdColumn: 'ability_id',
    scopeColumn: 'version_group_id',
    csvScopeColumn: 'version_group_id',
  },
  {
    csv: 'item_flavor_text',
    table: 'item_flavor_text',
    idColumn: 'item_id',
    csvIdColumn: 'item_id',
    scopeColumn: 'version_group_id',
    csvScopeColumn: 'version_group_id',
  },
];

/** Loads every flavor text table, storing each distinct text once in flavor_texts. */
function loadFlavorTexts(ctx: BuildContext): void {
  const ids = new Map<string, number>();
  const texts: SqlValue[][] = [];
  let references = 0;

  for (const source of FLAVOR_SOURCES) {
    const mappings: SqlValue[][] = [];
    for (const row of ctx.csv(source.csv)) {
      const lang = ctx.languages.code(row.language_id);
      const text = cleanFlavorText(row.flavor_text ?? '');
      if (!lang || text === '') continue;
      let id = ids.get(text);
      if (id === undefined) {
        id = ids.size + 1;
        ids.set(text, id);
        texts.push([id, text]);
      }
      mappings.push([
        toIntRequired(row[source.csvIdColumn]),
        toIntRequired(row[source.csvScopeColumn]),
        lang,
        id,
      ]);
    }
    references += ctx.insert(
      source.table,
      [source.idColumn, source.scopeColumn, 'lang', 'flavor_text_id'],
      mappings,
      { orIgnore: true },
    );
    ctx.release(source.csv);
  }
  ctx.insert('flavor_texts', ['id', 'text'], texts);
  ctx.log(`  flavor_texts: ${texts.length} distinct texts for ${references} references`);
}

/** Loads every PokeAPI-backed table (derived tables come later). */
export function loadTables(ctx: BuildContext): void {
  ctx.log('Loading PokeAPI CSVs…');
  loadLanguages(ctx);
  loadFlavors(ctx);
  for (const spec of TABLE_SPECS) runSpec(ctx, spec);
  loadEncounters(ctx);
  loadLearnsets(ctx);
  loadFlavorTexts(ctx);
}
