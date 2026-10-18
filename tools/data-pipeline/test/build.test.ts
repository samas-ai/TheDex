import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getLearnset,
  getPokemon,
  listGamePokemon,
  listGames,
  resolveGameContext,
  searchQuery,
} from '@thedex/db';
import { buildDatabase } from '../src/build';
import type { BuildReport } from '../src/finalize';
import { checkHotQueryPlans } from '../src/query-plans';
import { writeFixtureCsvs, writeFixtureCurated } from './fixtures/pokeapi';

let tmp: string;
let report: BuildReport;
let dedupedReport: BuildReport;
let sqlite: Database.Database;
let deduped: Database.Database;

function build(outFile: string, dedupeLearnsets: boolean) {
  return buildDatabase({
    csvDir: path.join(tmp, 'csv'),
    curatedDir: path.join(tmp, 'curated'),
    outFile,
    allowMissingCsv: true,
    analyze: false,
    dedupeLearnsets,
    log: () => {},
  });
}

beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'thedex-pipeline-'));
  writeFixtureCsvs(path.join(tmp, 'csv'));
  writeFixtureCurated(path.join(tmp, 'curated'));
  report = build(path.join(tmp, 'data.db'), false);
  dedupedReport = build(path.join(tmp, 'data-deduped.db'), true);
  sqlite = new Database(report.file, { readonly: true });
  deduped = new Database(dedupedReport.file, { readonly: true });
});

afterAll(() => {
  sqlite?.close();
  deduped?.close();
  rmSync(tmp, { recursive: true, force: true });
});

const value = (sql: string, ...params: unknown[]) =>
  sqlite
    .prepare(sql)
    .pluck()
    .get(...(params as never[]));
const typesOf = (pokemonId: number, gen: number) =>
  (
    sqlite
      .prepare(
        `SELECT t.identifier FROM pokemon_types_by_gen pt JOIN types t ON t.id = pt.type_id
         WHERE pt.pokemon_id = ? AND pt.generation_id = ? ORDER BY pt.slot`,
      )
      .pluck()
      .all(pokemonId, gen) as string[]
  ).join('/');
const moveAt = (moveId: number, vg: number) =>
  sqlite
    .prepare(
      `SELECT t.identifier AS type, dc.identifier AS class, ms.power FROM move_stats_by_vg ms
       JOIN types t ON t.id = ms.type_id JOIN move_damage_classes dc ON dc.id = ms.damage_class_id
       WHERE move_id = ? AND version_group_id = ?`,
    )
    .get(moveId, vg);

describe('database integrity', () => {
  it('has no integrity or foreign key violations', () => {
    expect(value('PRAGMA integrity_check')).toBe('ok');
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
  });

  it('records metadata and a deterministic data version', () => {
    expect(report.dataVersion).toMatch(/^1-[0-9a-f]{12}$/);
    expect(value(`SELECT value FROM meta WHERE key = 'data_version'`)).toBe(report.dataVersion);
    expect(value('PRAGMA user_version')).toBe(1);
    expect(dedupedReport.dataVersion).not.toBe(report.dataVersion);
  });

  it('creates pokemon_moves WITHOUT ROWID and ignores duplicate CSV rows', () => {
    expect(value(`SELECT sql FROM sqlite_master WHERE name = 'pokemon_moves'`)).toMatch(
      /WITHOUT ROWID$/,
    );
    expect(value('SELECT count(*) FROM pokemon_moves')).toBe(8);
  });

  it('reports table sizes and learnset dedupe potential', () => {
    expect(report.sizes?.some((s) => s.table === 'pokemon_moves')).toBe(true);
    expect(report.learnsetDedupePotential).toBe(1);
    expect(dedupedReport.learnsetDedupePotential).toBe(0);
  });
});

describe('materialized history', () => {
  it('resolves typing per generation', () => {
    expect(typesOf(35, 5)).toBe('normal');
    expect(typesOf(35, 6)).toBe('fairy');
    expect(typesOf(81, 1)).toBe('electric');
    expect(typesOf(81, 2)).toBe('electric/steel');
    expect(typesOf(935, 8)).toBe('');
    expect(typesOf(935, 9)).toBe('fire');
  });

  it('resolves base stats per generation, including the Gen 1 Special', () => {
    const gen1 = sqlite
      .prepare('SELECT * FROM pokemon_stats_by_gen WHERE pokemon_id = 1 AND generation_id = 1')
      .get() as Record<string, number>;
    expect(gen1).toMatchObject({ special: 65, special_attack: 65, special_defense: 65, bst: 253 });
    expect(
      value('SELECT special FROM pokemon_stats_by_gen WHERE pokemon_id = 1 AND generation_id = 2'),
    ).toBeNull();
    expect(
      value('SELECT defense FROM pokemon_stats_by_gen WHERE pokemon_id = 25 AND generation_id = 5'),
    ).toBe(30);
    expect(
      value('SELECT defense FROM pokemon_stats_by_gen WHERE pokemon_id = 25 AND generation_id = 6'),
    ).toBe(40);
  });

  it('resolves abilities per generation (none before Gen 3, hidden from Gen 5)', () => {
    const abilities = (gen: number) =>
      sqlite
        .prepare(
          'SELECT ability_id, is_hidden FROM pokemon_abilities_by_gen WHERE pokemon_id = 1 AND generation_id = ? ORDER BY slot',
        )
        .all(gen);
    expect(abilities(2)).toEqual([]);
    expect(abilities(4)).toEqual([{ ability_id: 65, is_hidden: 0 }]);
    expect(abilities(5)).toEqual([
      { ability_id: 65, is_hidden: 0 },
      { ability_id: 34, is_hidden: 1 },
    ]);
  });

  it('resolves move stats per version group (changelog + Gen 1-3 split)', () => {
    expect(moveAt(2, 1)).toEqual({ type: 'normal', class: 'physical', power: 50 });
    expect(moveAt(2, 3)).toEqual({ type: 'fighting', class: 'physical', power: 50 });
    expect(moveAt(44, 1)).toEqual({ type: 'normal', class: 'physical', power: 60 });
    expect(moveAt(44, 3)).toEqual({ type: 'dark', class: 'special', power: 60 });
    expect(moveAt(44, 8)).toEqual({ type: 'dark', class: 'physical', power: 60 });
    expect(moveAt(53, 1)).toMatchObject({ power: 95 });
    expect(moveAt(53, 8)).toMatchObject({ power: 90 });
  });
});

describe('games and curated data', () => {
  it('builds curated games with localized names', async () => {
    const games = await listGames(drizzle(sqlite), ['pt-BR', 'en']);
    expect(games.map((g) => g.identifier)).toEqual([
      'red-blue',
      'gold-silver',
      'diamond-pearl',
      'scarlet-violet',
    ]);
    expect(games.find((g) => g.identifier === 'scarlet-violet')?.name).toBe('Scarlet / Violet');
  });

  it('applies pt-BR names and tags', () => {
    expect(value(`SELECT name FROM type_i18n WHERE type_id = 10 AND lang = 'pt-BR'`)).toBe('Fogo');
    expect(value(`SELECT name FROM nature_i18n WHERE nature_id = 3 AND lang = 'pt-BR'`)).toBe(
      'Firme',
    );
    expect(value(`SELECT count(*) FROM species_tags WHERE tag = 'starter'`)).toBe(3);
    expect(value(`SELECT has_game_data FROM languages WHERE code = 'pt-BR'`)).toBe(1);
  });

  it('merges Showdown data (IDs, Max power, form changes)', () => {
    expect(value('SELECT ps_id FROM pokemon WHERE id = 10034')).toBe('charizardmegax');
    expect(value('SELECT max_power FROM moves WHERE id = 85')).toBe(130);
    expect(
      value('SELECT kind FROM form_changes WHERE from_pokemon_id = 6 AND to_pokemon_id = 10034'),
    ).toBe('mega');
    expect(value(`SELECT count(*) FROM move_flag_map WHERE move_id = 44`)).toBeGreaterThan(0);
  });

  it('stores each flavor text once and cleans line breaks', () => {
    expect(value('SELECT count(*) FROM species_flavor_text')).toBe(2);
    expect(value('SELECT count(*) FROM flavor_texts')).toBe(1);
    expect(value('SELECT text FROM flavor_texts')).toBe(
      'When several of these POKéMON gather, their electricity could build.',
    );
  });
});

describe('repositories over the built database', () => {
  it('lists game Pokémon by regional number', async () => {
    const db = drizzle(sqlite);
    const ctx = await resolveGameContext(db, 'scarlet-violet', ['pt-BR']);
    expect(ctx.langChain).toEqual(['pt-BR', 'en']);
    expect(ctx.versionGroupIds).toEqual([25, 26]);
    const list = await listGamePokemon(db, ctx);
    expect(list.map((p) => [p.name, p.regionalNumber])).toEqual([
      ['Charcadet', 26],
      ['Pikachu', 74],
      ['Charmander', 150],
    ]);
  });

  it('resolves a Pokémon for the context generation and languages', async () => {
    const db = drizzle(sqlite);
    const pikachu = await getPokemon(db, 25, await resolveGameContext(db, 'red-blue', ['ja-Hrkt']));
    expect(pikachu).toMatchObject({
      name: 'ピカチュウ',
      genus: 'ねずみポケモン',
      types: ['electric'],
    });
    expect(pikachu?.abilities).toEqual([]);
    const megaX = await getPokemon(
      db,
      10034,
      await resolveGameContext(db, 'scarlet-violet', ['en']),
    );
    expect(megaX).toMatchObject({ name: 'Mega Charizard X', types: ['fire', 'dragon'] });
    expect(
      await getPokemon(db, 99999, await resolveGameContext(db, 'red-blue', ['en'])),
    ).toBeNull();
  });

  it('merges DLC learnsets and keeps them identical after the dedupe', async () => {
    for (const handle of [sqlite, deduped]) {
      const db = drizzle(handle);
      const ctx = await resolveGameContext(db, 'scarlet-violet', ['en']);
      expect(await getLearnset(db, 25, ctx)).toEqual({
        'level-up': [{ moveId: 1, level: 1 }],
        machine: [
          { moveId: 44, level: 0 },
          { moveId: 85, level: 0 },
        ],
      });
    }
    expect(deduped.prepare('SELECT count(*) FROM pokemon_moves').pluck().get()).toBe(7);
  });
});

describe('search', () => {
  const search = (text: string, langChain: string[], entityTypes?: ['pokemon']) =>
    searchQuery(drizzle(sqlite), text, { langChain }, entityTypes ? { entityTypes } : {});

  it('ranks prefix matches before substring matches ("char")', async () => {
    const result = await search('char', ['en'], ['pokemon']);
    expect(result.hits.map((h) => h.name)).toEqual([
      'Charmander',
      'Charmeleon',
      'Charizard',
      'Charjabug',
      'Charcadet',
      'Mega Charizard X',
      'Chimchar',
    ]);
  });

  it('handles short, Japanese, alias and translated queries', async () => {
    expect((await search('pi', ['en'])).hits[0]?.name).toBe('Pikachu');
    expect((await search('ぴか', ['ja-Hrkt', 'en'])).hits[0]?.name).toBe('ピカチュウ');
    expect((await search('カチ', ['ja-Hrkt', 'en'])).hits[0]?.name).toBe('ピカチュウ');
    expect((await search('rato elétrico', ['en'])).hits[0]?.name).toBe('Pikachu');
    expect((await search('charizardmegax', ['en'])).hits[0]?.name).toBe('Mega Charizard X');
    const fogo = await search('fogo', ['pt-BR', 'en']);
    expect(fogo.byType.type?.[0]).toMatchObject({ name: 'Fogo', entityId: 10 });
    expect((await search('   ', ['en'])).hits).toEqual([]);
    expect((await search('zzzz', ['en'])).hits).toEqual([]);
  });

  it('serves hot queries without full scans of large tables', async () => {
    const { checked, violations } = await checkHotQueryPlans(sqlite, {
      game: 'scarlet-violet',
      pokemonId: 25,
    });
    expect(checked).toBeGreaterThanOrEqual(10);
    expect(violations).toEqual([]);
  });
});
