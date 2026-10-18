import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import Database from 'better-sqlite3';
import { gameSchemaDdl } from '@thedex/db/ddl';
import { GAME_SCHEMA_VERSION } from '@thedex/db/game';
import { CRIES_SHA, POKEAPI_SHA, REPO_ROOT, SPRITES_SHA } from './config';
import { BuildContext, type BuildOptions } from './context';
import { CURATED_FILES, loadCurated } from './curated';
import { derivePtBr, deriveSpeciesTags } from './derive/curated';
import { deriveFormKinds } from './derive/forms';
import { deriveGames } from './derive/games';
import { deriveHistory } from './derive/history';
import { dedupeLearnsetsByGame } from './derive/learnsets';
import { deriveMedia } from './derive/media';
import { deriveMoveStats } from './derive/moves';
import { derivePkmn } from './derive/pkmn';
import { deriveSearch } from './derive/search';
import { finalize, type BuildReport } from './finalize';
import { loadTables } from './load/run';

const require = createRequire(import.meta.url);
export const PKMN_VERSION = (require('@pkmn/dex/package.json') as { version: string }).version;

/** Source files whose content affects the generated data (hashed into data_version). */
const DATA_SOURCE_DIRS = [
  path.join(REPO_ROOT, 'tools', 'data-pipeline', 'src'),
  path.join(REPO_ROOT, 'packages', 'db', 'src', 'schema', 'game'),
  path.join(REPO_ROOT, 'packages', 'db', 'src', 'search'),
];
const DATA_SOURCE_FILES = [path.join(REPO_ROOT, 'packages', 'db', 'src', 'ddl.ts')];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((entry) => {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) return entry === 'cli' ? [] : sourceFiles(full);
      return entry.endsWith('.ts') && !entry.endsWith('.test.ts') ? [full] : [];
    })
    .sort();
}

/**
 * Deterministic data version: changes only when an input changes (PokeAPI SHA, @pkmn/dex,
 * curated JSON, schema/pipeline code, dedupe flag) — so rebuilding is idempotent and the
 * app recopies its asset exactly when the data changed.
 */
export function computeDataVersion(options: BuildOptions): string {
  const hash = createHash('sha256');
  hash.update(`schema:${GAME_SCHEMA_VERSION}\npokeapi:${POKEAPI_SHA}\npkmn:${PKMN_VERSION}\n`);
  hash.update(`dedupe:${options.dedupeLearnsets ? 1 : 0}\n`);
  for (const file of CURATED_FILES) hash.update(readFileSync(path.join(options.curatedDir, file)));
  for (const file of [...DATA_SOURCE_DIRS.flatMap(sourceFiles), ...DATA_SOURCE_FILES]) {
    hash.update(path.relative(REPO_ROOT, file).replaceAll('\\', '/'));
    hash.update(readFileSync(file, 'utf8').replaceAll('\r\n', '\n'));
  }
  return `${GAME_SCHEMA_VERSION}-${hash.digest('hex').slice(0, 12)}`;
}

/** Builds thedex-data.db from scratch. Pure library function (the CLI publishes outputs). */
export function buildDatabase(options: BuildOptions): BuildReport {
  mkdirSync(path.dirname(options.outFile), { recursive: true });
  if (existsSync(options.outFile)) rmSync(options.outFile);

  const db = new Database(options.outFile);
  try {
    db.pragma('page_size = 4096');
    db.pragma('journal_mode = OFF');
    db.pragma('synchronous = OFF');
    db.pragma('temp_store = MEMORY');
    db.pragma('cache_size = -262144');
    db.pragma('foreign_keys = OFF');
    for (const statement of gameSchemaDdl()) db.exec(statement);

    const ctx = new BuildContext(db, options, loadCurated(options.curatedDir));
    loadTables(ctx);
    ctx.log('Deriving…');
    deriveHistory(ctx);
    deriveMoveStats(ctx);
    deriveGames(ctx);
    derivePkmn(ctx);
    deriveFormKinds(ctx);
    deriveSpeciesTags(ctx);
    derivePtBr(ctx);
    if (options.dedupeLearnsets) dedupeLearnsetsByGame(ctx);
    deriveSearch(ctx);
    deriveMedia(ctx);
    ctx.log('Finalizing…');
    return finalize(ctx, {
      dataVersion: computeDataVersion(options),
      pokeapiSha: POKEAPI_SHA,
      pkmnVersion: PKMN_VERSION,
      spritesSha: SPRITES_SHA,
      criesSha: CRIES_SHA,
    });
  } finally {
    db.close();
  }
}
