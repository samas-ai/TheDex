import { statSync } from 'node:fs';
import { GAME_SCHEMA_VERSION, SEARCH_FTS_TABLE } from '@thedex/db/game';
import type { BuildContext } from './context';
import { countDedupableLearnsets } from './derive/learnsets';

export interface TableSize {
  readonly table: string;
  /** Table pages (including FTS shadow tables under the virtual table's name). */
  readonly tableBytes: number;
  readonly indexBytes: number;
  readonly totalBytes: number;
  readonly pct: number;
}

export interface BuildReport {
  readonly file: string;
  readonly sizeBytes: number;
  readonly dataVersion: string;
  readonly schemaVersion: number;
  readonly pokeapiSha: string;
  readonly pkmnVersion: string;
  readonly builtAt: string;
  readonly dedupeLearnsets: boolean;
  /** Rows the per-game learnset dedupe would (still) remove — its potential savings. */
  readonly learnsetDedupePotential: number;
  readonly counts: Readonly<Record<string, number>>;
  /** Null when the SQLite build lacks the dbstat virtual table. */
  readonly sizes: readonly TableSize[] | null;
}

export interface FinalizeInfo {
  readonly dataVersion: string;
  readonly pokeapiSha: string;
  readonly pkmnVersion: string;
}

function sizeReport(ctx: BuildContext, fileBytes: number): TableSize[] | null {
  let rows: { name: string; tbl_name: string | null; type: string | null; bytes: number }[];
  try {
    rows = ctx.all(`
      SELECT s.name, m.tbl_name, m.type, sum(s.pgsize) AS bytes
      FROM dbstat s LEFT JOIN sqlite_master m ON m.name = s.name
      GROUP BY s.name`);
  } catch {
    return null;
  }
  const byTable = new Map<string, { tableBytes: number; indexBytes: number }>();
  for (const row of rows) {
    // FTS5 shadow tables (search_fts_data, _idx, _docsize, _config) roll up into search_fts.
    const owner = row.name.startsWith(`${SEARCH_FTS_TABLE}_`)
      ? SEARCH_FTS_TABLE
      : (row.tbl_name ?? row.name);
    const entry = byTable.get(owner) ?? { tableBytes: 0, indexBytes: 0 };
    if (row.type === 'index') entry.indexBytes += row.bytes;
    else entry.tableBytes += row.bytes;
    byTable.set(owner, entry);
  }
  return [...byTable.entries()]
    .map(([table, { tableBytes, indexBytes }]) => ({
      table,
      tableBytes,
      indexBytes,
      totalBytes: tableBytes + indexBytes,
      pct: Math.round(((tableBytes + indexBytes) / fileBytes) * 1000) / 10,
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes);
}

/** Metadata, planner stats, compaction and the size/row-count report. */
export function finalize(ctx: BuildContext, info: FinalizeInfo): BuildReport {
  const { db } = ctx;
  const builtAt = new Date().toISOString();

  db.exec(`
    UPDATE languages SET has_game_data = (
      EXISTS (SELECT 1 FROM species_i18n WHERE lang = languages.code)
      OR EXISTS (SELECT 1 FROM move_i18n WHERE lang = languages.code)
      OR EXISTS (SELECT 1 FROM type_i18n WHERE lang = languages.code));`);

  ctx.insert(
    'meta',
    ['key', 'value'],
    [
      ['schema_version', String(GAME_SCHEMA_VERSION)],
      ['data_version', info.dataVersion],
      ['source_pokeapi_sha', info.pokeapiSha],
      ['source_pkmn_version', info.pkmnVersion],
      ['dedupe_learnsets', ctx.options.dedupeLearnsets ? '1' : '0'],
      ['built_at', builtAt],
    ],
  );
  db.pragma(`user_version = ${GAME_SCHEMA_VERSION}`);
  const learnsetDedupePotential = countDedupableLearnsets(ctx);

  db.exec(`INSERT INTO "${SEARCH_FTS_TABLE}"("${SEARCH_FTS_TABLE}") VALUES ('optimize');`);
  if (ctx.options.analyze !== false) db.exec('ANALYZE;');
  db.exec('VACUUM;');

  const tables = ctx.all<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       AND name NOT LIKE '${SEARCH_FTS_TABLE}_%' ORDER BY name`,
  );
  const counts = Object.fromEntries(
    tables.map(({ name }) => [
      name,
      (db.prepare(`SELECT count(*) AS n FROM "${name}"`).get() as { n: number }).n,
    ]),
  );
  const sizeBytes = statSync(ctx.options.outFile).size;

  return {
    file: ctx.options.outFile,
    sizeBytes,
    dataVersion: info.dataVersion,
    schemaVersion: GAME_SCHEMA_VERSION,
    pokeapiSha: info.pokeapiSha,
    pkmnVersion: info.pkmnVersion,
    builtAt,
    dedupeLearnsets: ctx.options.dedupeLearnsets ?? false,
    learnsetDedupePotential,
    counts,
    sizes: sizeReport(ctx, sizeBytes),
  };
}
