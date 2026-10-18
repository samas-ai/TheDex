import type Database from 'better-sqlite3';
import { readCsv, type CsvRow } from './csv';
import type { CuratedData } from './curated';
import { LanguageMap } from './lang';
import type { SqlValue } from './values';

export interface BuildOptions {
  /** Directory with the PokeAPI CSVs. */
  readonly csvDir: string;
  /** Directory with data/curated JSON files. */
  readonly curatedDir: string;
  /** Media directory listing (see media-listing.ts); required unless `allowMissingCsv`. */
  readonly mediaListingFile?: string;
  /** Output .db path. */
  readonly outFile: string;
  /** Tolerate missing CSV files (test fixtures ship a subset). */
  readonly allowMissingCsv?: boolean;
  /** Keep only rows that differ from the base version group in DLC version groups. */
  readonly dedupeLearnsets?: boolean;
  /** Run ANALYZE (query-planner stats). Disabled for tiny fixture DBs. */
  readonly analyze?: boolean;
  readonly log?: (message: string) => void;
}

/** Shared state for one pipeline run. */
export class BuildContext {
  readonly languages: LanguageMap;
  private readonly cache = new Map<string, CsvRow[]>();

  constructor(
    readonly db: Database.Database,
    readonly options: BuildOptions,
    readonly curated: CuratedData,
  ) {
    this.languages = new LanguageMap(this.csv('languages'));
  }

  /** Parsed CSV rows (cached for the run). */
  csv(name: string): CsvRow[] {
    let rows = this.cache.get(name);
    if (!rows) {
      rows = readCsv(this.options.csvDir, name, { optional: this.options.allowMissingCsv });
      this.cache.set(name, rows);
    }
    return rows;
  }

  /** Drops a large CSV from the cache once it is no longer needed. */
  release(name: string): void {
    this.cache.delete(name);
  }

  log(message: string): void {
    (this.options.log ?? console.log)(message);
  }

  /** Bulk insert inside one transaction. Returns how many rows were actually inserted. */
  insert(
    table: string,
    columns: readonly string[],
    rows: Iterable<readonly SqlValue[]>,
    options: { orIgnore?: boolean; orReplace?: boolean } = {},
  ): number {
    const verb = options.orReplace
      ? 'INSERT OR REPLACE'
      : options.orIgnore
        ? 'INSERT OR IGNORE'
        : 'INSERT';
    const statement = this.db.prepare(
      `${verb} INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    );
    let inserted = 0;
    this.db.transaction(() => {
      for (const row of rows) inserted += statement.run(...row).changes;
    })();
    return inserted;
  }

  /** `SELECT` helper returning typed rows. */
  all<T>(sql: string, ...params: SqlValue[]): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }
}
