/**
 * RNF07 benchmark: ~1000 search queries (1–12 chars, several languages incl. CJK), the
 * Pokédex list (RF01) with every sort and filter, the Phase 3 encyclopedia lists and details
 * and the Phase 4 tools (checklist, team builder lookups), against the real thedex-data.db. Fails when a p95 is ≥ 100 ms or the "char"
 * ordering regresses.
 */
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import {
  getAbilityHolders,
  getChecklistEntries,
  getItemDetail,
  getLocationEncounters,
  getMoveDetail,
  getMoveLearners,
  getMoveSummaries,
  getPokemonMoves,
  getShowdownNames,
  listAbilityDex,
  listChecklistDex,
  listItems,
  listLocationRegions,
  listLocations,
  listMoves,
  listPokedex,
  MOVE_SORT_KEYS,
  POKEDEX_SORT_KEYS,
  resolveGameContext,
  resolveShowdownNames,
  searchQuery,
  type PokedexFilters,
} from '@thedex/db';
import { DATA_DB_FILE, DIST_DIR } from '../config';
import { openAppLikeConnection } from '../query-plans';

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

// --- Pokédex list (RF01.3 filters / RF01.4 sorts), on the app's connection layout ------
const app = openAppLikeConnection(path.join(DIST_DIR, DATA_DB_FILE));
const appDb = drizzle(app);
const FILTERS: readonly PokedexFilters[] = [
  {},
  { typeIds: [10] },
  { typeIds: [11, 3] },
  { generationIds: [1, 2] },
  { regionIds: [1] },
  { abilityId: 26 },
  { eggGroupId: 1 },
  { tags: ['legendary', 'mythical'] },
  { capture: { scope: 'national', status: 'not-caught' } },
  { includeForms: false },
];
const listTimings: number[] = [];
let listRows = 0;
for (const game of ['red-blue', 'emerald', 'sword-shield', 'scarlet-violet']) {
  const ctx = await resolveGameContext(appDb, game, ['pt-BR', 'en']);
  await listPokedex(appDb, ctx); // warm-up
  for (const key of POKEDEX_SORT_KEYS) {
    for (const filters of FILTERS) {
      const started = performance.now();
      listRows += (await listPokedex(appDb, ctx, { filters, sort: { key, direction: 'desc' } }))
        .length;
      listTimings.push(performance.now() - started);
    }
  }
}
const listP95 = percentile(listTimings, 95);
console.log(
  `Pokédex list — ${listTimings.length} queries (${listRows} rows): p50 ${fmt(percentile(listTimings, 50))} · ` +
    `p95 ${fmt(listP95)} · max ${fmt(Math.max(...listTimings))}`,
);

// --- Encyclopedias (Phase 3) and tools (Phase 4): lists, details and lookups ---------------
const dexTimings: number[] = [];
const timed = async (fn: () => Promise<unknown>) => {
  const started = performance.now();
  await fn();
  dexTimings.push(performance.now() - started);
};
for (const game of ['red-blue', 'heartgold-soulsilver', 'sword-shield', 'scarlet-violet']) {
  const ctx = await resolveGameContext(appDb, game, ['pt-BR', 'en']);
  await listMoves(appDb, ctx); // warm-up
  for (const key of MOVE_SORT_KEYS) {
    await timed(() => listMoves(appDb, ctx, { sort: { key, direction: 'desc' } }));
    await timed(() =>
      listMoves(appDb, ctx, {
        filters: { typeIds: [13], damageClasses: ['special'], learnableOnly: true },
        sort: { key, direction: 'asc' },
      }),
    );
  }
  await timed(() => listAbilityDex(appDb, ctx, { inGameOnly: true }));
  await timed(() => listItems(appDb, ctx));
  await timed(() => listItems(appDb, ctx, { groups: ['machine'], inGameOnly: true }));
  for (const region of await listLocationRegions(appDb, ctx)) {
    await timed(() => listLocations(appDb, ctx, { regionId: region.id }));
  }
  for (const moveId of [85, 182, 33]) {
    await timed(() => getMoveDetail(appDb, moveId, ctx));
    await timed(() => getMoveLearners(appDb, moveId, ctx));
  }
  await timed(() => getAbilityHolders(appDb, 26, ctx));
  await timed(() => getItemDetail(appDb, 211, ctx));
  await timed(() => getLocationEncounters(appDb, 80, ctx));
  // Phase 4 tools: checklist (RF09) and team builder lookups (RF08).
  await timed(() => listChecklistDex(appDb, ctx, 'national'));
  await timed(() => listChecklistDex(appDb, ctx, 'game'));
  await timed(() => getChecklistEntries(appDb, 'national'));
  await timed(() => getPokemonMoves(appDb, 445, ctx));
  await timed(() => getMoveSummaries(appDb, ctx, [85, 89, 53, 58]));
  await timed(() =>
    resolveShowdownNames(appDb, {
      species: ['Garchomp', 'Rotom-Wash', 'Vivillon-Pokeball'],
      items: ['Leftovers', 'Choice Scarf'],
      abilities: ['Rough Skin'],
      moves: ['Earthquake', 'U-turn', 'Hidden Power'],
    }),
  );
  await timed(() =>
    getShowdownNames(appDb, { pokemon: [445], items: [211], abilities: [24], moves: [89, 369] }),
  );
}
app.close();
const dexP95 = percentile(dexTimings, 95);
console.log(
  `Encyclopedias and tools — ${dexTimings.length} queries: p50 ${fmt(percentile(dexTimings, 50))} · ` +
    `p95 ${fmt(dexP95)} · max ${fmt(Math.max(...dexTimings))}`,
);

const p95 = percentile(timings, 95);
db.close();
if (p95 >= BUDGET_MS || listP95 >= BUDGET_MS || dexP95 >= BUDGET_MS || !orderOk) {
  console.error(
    `✗ ${!orderOk ? '"char" ordering regressed' : `p95 search ${fmt(p95)} / list ${fmt(listP95)} / encyclopedias ${fmt(dexP95)} ≥ ${BUDGET_MS} ms`}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `✓ p95 search ${fmt(p95)}, list ${fmt(listP95)}, encyclopedias ${fmt(dexP95)} < ${BUDGET_MS} ms; "char" ordering correct`,
  );
}
