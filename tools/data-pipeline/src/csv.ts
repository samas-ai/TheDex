import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

export type CsvRow = Record<string, string>;

/** Reads a PokeAPI CSV (header row → object keys). Missing files throw unless `optional`. */
export function readCsv(dir: string, name: string, options: { optional?: boolean } = {}): CsvRow[] {
  const file = path.join(dir, `${name}.csv`);
  if (!existsSync(file)) {
    if (options.optional) return [];
    throw new Error(`Missing CSV ${file} — run \`pnpm data:fetch\` first`);
  }
  return parse(readFileSync(file), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    // A few PokeAPI rows have a space between the delimiter and an opening quote.
    ltrim: true,
    relax_quotes: true,
  }) as CsvRow[];
}
