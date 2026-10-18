/**
 * RNF07 benchmark: ~1000 search queries (1–12 chars, several languages incl. CJK) against
 * the real thedex-data.db. Fails when p95 ≥ 100 ms or the "char" ordering regresses.
 */
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { searchQuery } from '@thedex/db';
import { DATA_DB_FILE, DIST_DIR } from '../config';

const BUDGET_MS = 100;
const QUERY_COUNT = 1000;

/** Small deterministic PRNG (mulberry32) so runs are comparable. */
function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LANG_CHAINS: readonly (readonly string[])[] = [
  ['en'],
  ['pt-BR', 'en'],
  ['ja-Hrkt', 'ja', 'en'],
  ['ko', 'en'],
  ['zh-Hans', 'en'],
  ['fr', 'en'],
  ['de', 'en'],
  ['es', 'en'],
];

const FIXED: readonly [string, readonly string[]][] = [
  ['char', ['en']],
  ['pika', ['en']],
  ['mr. mime', ['en']],
  ['flabébé', ['en']],
  ['c', ['en']],
  ['ch', ['pt-BR', 'en']],
  ['fogo', ['pt-BR', 'en']],
  ['ピカ', ['ja-Hrkt', 'ja', 'en']],
  ['ぴかちゅう', ['ja-Hrkt', 'ja', 'en']],
  ['皮卡', ['zh-Hans', 'en']],
  ['피카', ['ko', 'en']],
  ['thunder', ['en']],
  ['leftovers', ['en']],
];

const db = new Database(path.join(DIST_DIR, DATA_DB_FILE), { readonly: true });
const orm = drizzle(db);
const random = prng(2026);

const langs = ['en', 'ja-Hrkt', 'ko', 'zh-Hans', 'fr', 'de', 'es', 'it'];
const sampleNames = db
  .prepare(`SELECT name, lang FROM search_terms WHERE lang IN (${langs.map(() => '?').join(',')})`)
  .all(...langs) as { name: string; lang: string }[];

const queries: [string, readonly string[]][] = [...FIXED];
while (queries.length < QUERY_COUNT) {
  const { name, lang } = sampleNames[Math.floor(random() * sampleNames.length)]!;
  const chars = Array.from(name);
  const length = 1 + Math.floor(random() * Math.min(12, chars.length));
  const start = Math.floor(random() * (chars.length - length + 1));
  const chain = LANG_CHAINS.find((c) => c[0] === lang) ?? [lang, 'en'];
  queries.push([chars.slice(start, start + length).join(''), chain]);
}

// Warm-up (page cache, prepared statements).
for (const [text, chain] of queries.slice(0, 50))
  await searchQuery(orm, text, { langChain: chain });

const timings: number[] = [];
const byLength = new Map<number, number[]>();
for (const [text, chain] of queries) {
  const started = performance.now();
  await searchQuery(orm, text, { langChain: chain });
  const elapsed = performance.now() - started;
  timings.push(elapsed);
  const bucket = Math.min(Array.from(text).length, 6);
  byLength.set(bucket, [...(byLength.get(bucket) ?? []), elapsed]);
}

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
};
const fmt = (ms: number) => `${ms.toFixed(2)} ms`;

console.log(`Search benchmark — ${timings.length} queries against ${DATA_DB_FILE}`);
console.log(
  `  p50 ${fmt(percentile(timings, 50))} · p95 ${fmt(percentile(timings, 95))} · ` +
    `p99 ${fmt(percentile(timings, 99))} · max ${fmt(Math.max(...timings))}`,
);
for (const [length, values] of [...byLength.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(
    `  ${length === 6 ? '6+' : `${length} `} chars: p95 ${fmt(percentile(values, 95))} (${values.length} queries)`,
  );
}

const char = await searchQuery(
  orm,
  'char',
  { langChain: ['en'] },
  { entityTypes: ['pokemon'], limitPerType: 12 },
);
console.log(`  "char" → ${char.hits.map((hit) => hit.name).join(', ')}`);
const names = char.hits.map((hit) => hit.name);
const expectedOrder = [
  'Charmander',
  'Charmeleon',
  'Charizard',
  'Charjabug',
  'Charcadet',
  'Chimchar',
];
const positions = expectedOrder.map((name) => names.indexOf(name));
const orderOk = positions.every((p, i) => p >= 0 && (i === 0 || p > positions[i - 1]!));

const p95 = percentile(timings, 95);
db.close();
if (p95 >= BUDGET_MS || !orderOk) {
  console.error(
    `✗ ${!orderOk ? '"char" ordering regressed' : `p95 ${fmt(p95)} ≥ ${BUDGET_MS} ms`}`,
  );
  process.exitCode = 1;
} else {
  console.log(`✓ p95 ${fmt(p95)} < ${BUDGET_MS} ms and "char" ordering correct`);
}
