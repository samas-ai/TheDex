import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteMediaCacheEntries,
  getAbilityDetail,
  getEvolutionChain,
  getFlavorTexts,
  getMediaCacheEntry,
  getMediaCacheStats,
  getMediaPackSizes,
  getMediaSources,
  getPokemonEncounters,
  getPokemonForms,
  getPokemonMedia,
  getPokemonMoves,
  getPokemonProfile,
  listAbilities,
  listEggGroups,
  listGameLanguages,
  listGenerations,
  listMediaAssets,
  listMediaCacheKeys,
  listPokedex,
  listRegions,
  listSpeciesTags,
  listTypes,
  mediaCacheKey,
  mediaUrl,
  putMediaCacheEntry,
  resolveGameContext,
  touchMediaCacheEntry,
  type GameContext,
} from '@thedex/db';
import { buildDatabase } from '../src/build';
import { SPRITES_SHA } from '../src/config';
import { openAppLikeConnection } from '../src/query-plans';
import {
  writeFixtureCsvs,
  writeFixtureCurated,
  writeFixtureMediaListing,
} from './fixtures/pokeapi';

let tmp: string;
let app: Database.Database;
let db: ReturnType<typeof drizzle>;
let sv: GameContext;
let rb: GameContext;

beforeAll(async () => {
  tmp = mkdtempSync(path.join(os.tmpdir(), 'thedex-repos-'));
  writeFixtureCsvs(path.join(tmp, 'csv'));
  writeFixtureCurated(path.join(tmp, 'curated'));
  writeFixtureMediaListing(path.join(tmp, 'media.json'));
  const report = buildDatabase({
    csvDir: path.join(tmp, 'csv'),
    curatedDir: path.join(tmp, 'curated'),
    mediaListingFile: path.join(tmp, 'media.json'),
    outFile: path.join(tmp, 'data.db'),
    allowMissingCsv: true,
    analyze: false,
    log: () => {},
  });
  // Same layout as the app: user DB as main, game DB attached.
  app = openAppLikeConnection(report.file);
  db = drizzle(app);
  sv = await resolveGameContext(db, 'scarlet-violet', ['en']);
  rb = await resolveGameContext(db, 'red-blue', ['en']);
});

afterAll(() => {
  app?.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe('game context', () => {
  it('includes the versions of every version group of the game', () => {
    expect(sv.versionIds).toEqual([40, 41, 42]);
    expect(rb.versionIds).toEqual([1, 2]);
  });
});

describe('listPokedex (RF01)', () => {
  const names = async (ctx: GameContext, query: Parameters<typeof listPokedex>[2]) =>
    (await listPokedex(db, ctx, query)).map((entry) => entry.name);

  it('orders by regional dex (in game dex order), then national', async () => {
    const list = await listPokedex(db, sv);
    expect(list.map((p) => [p.name, p.regionalNumber, p.pokedexId])).toEqual([
      ['Charcadet', 26, 31],
      ['Pikachu', 74, 31],
      ['Charmander', 150, 32],
      ['Charizard', 151, 32],
      ['Mega Charizard X', 151, 32],
    ]);
    expect(list[1]).toMatchObject({ nationalNumber: 25, types: ['electric'], isDefault: true });
    expect(list[1]?.stats).toMatchObject({ speed: 90, bst: 320 });
    expect(list[4]).toMatchObject({ isDefault: false, types: ['fire', 'dragon'] });
  });

  it('sorts by national number, name, measurements and stats in both directions', async () => {
    expect(await names(sv, { sort: { key: 'national', direction: 'desc' } })).toEqual([
      'Charcadet',
      'Pikachu',
      'Charizard',
      'Mega Charizard X',
      'Charmander',
    ]);
    expect(await names(sv, { sort: { key: 'name', direction: 'asc' } })).toEqual([
      'Charcadet',
      'Charizard',
      'Charmander',
      'Mega Charizard X',
      'Pikachu',
    ]);
    expect(await names(sv, { sort: { key: 'weight', direction: 'desc' } })).toEqual([
      'Charcadet',
      'Mega Charizard X',
      'Pikachu',
      'Charizard',
      'Charmander',
    ]);
    expect((await names(sv, { sort: { key: 'height', direction: 'asc' } }))[0]).toBe('Charmander');
    expect(await names(sv, { sort: { key: 'speed', direction: 'desc' } })).toEqual([
      'Charizard',
      'Mega Charizard X',
      'Pikachu',
      'Charmander',
      'Charcadet',
    ]);
    expect((await names(sv, { sort: { key: 'attack', direction: 'desc' } }))[0]).toBe(
      'Mega Charizard X',
    );
    expect((await names(rb, { sort: { key: 'bst', direction: 'asc' } }))[0]).toBe('Bulbasaur');
    expect(await names(rb, { limit: 2, offset: 1 })).toEqual(['Charmander', 'Charmeleon']);
  });

  it('filters by combined types, generation, region, ability, egg group and tags', async () => {
    expect(await names(sv, { filters: { typeIds: [10, 16] } })).toEqual(['Mega Charizard X']);
    expect(await names(rb, { filters: { typeIds: [10, 3] } })).toEqual(['Charizard']);
    expect(await names(sv, { filters: { typeIds: [10], includeForms: false } })).toEqual([
      'Charcadet',
      'Charmander',
      'Charizard',
    ]);
    expect(await names(sv, { filters: { generationIds: [9] } })).toEqual(['Charcadet']);
    expect(await names(sv, { filters: { regionIds: [1] } })).toEqual([
      'Pikachu',
      'Charmander',
      'Charizard',
      'Mega Charizard X',
    ]);
    expect(await names(sv, { filters: { abilityId: 66 } })).toEqual(['Charmander']);
    expect(await names(sv, { filters: { eggGroupId: 14 } })).toEqual(['Charmander']);
    expect(await names(sv, { filters: { tags: ['starter'] } })).toEqual(['Charmander']);
  });

  it('filters by capture status through the attached user DB', async () => {
    app.exec(`
      INSERT INTO checklist_entries (dex_scope, pokemon_id, form_id, seen, caught, shiny_caught)
      VALUES ('national', 25, 0, 1, 1, 0), ('national', 4, 0, 1, 0, 0),
             ('national', 935, 0, 0, 0, 1), ('version:40', 6, 0, 1, 1, 0);
      INSERT INTO checklist_entries (dex_scope, pokemon_id, form_id, caught, deleted_at)
      VALUES ('national', 10034, 0, 1, 123);`);
    const capture = (status: 'seen' | 'caught' | 'shiny' | 'not-caught') =>
      names(sv, { filters: { capture: { scope: 'national', status } } });
    expect(await capture('seen')).toEqual(['Charcadet', 'Pikachu', 'Charmander']);
    expect(await capture('caught')).toEqual(['Charcadet', 'Pikachu']);
    expect(await capture('shiny')).toEqual(['Charcadet']);
    expect(await capture('not-caught')).toEqual(['Charmander', 'Charizard', 'Mega Charizard X']);
  });
});

describe('filter catalogs', () => {
  it('lists types, generations, regions, egg groups, abilities, tags and languages', async () => {
    expect((await listTypes(db, rb)).map((t) => t.identifier)).not.toContain('steel');
    expect((await listTypes(db, sv)).find((t) => t.id === 10)?.name).toBe('Fire');
    expect((await listGenerations(db, rb)).map((g) => g.id)).toEqual([1]);
    expect((await listRegions(db, sv)).map((r) => r.identifier)).toEqual(['kanto', 'paldea']);
    expect(await listEggGroups(db, rb)).toEqual([]);
    expect((await listEggGroups(db, sv)).map((e) => e.name)).toEqual(['Dragon', 'Monster']);
    expect((await listAbilities(db, sv)).map((a) => a.identifier)).toEqual([
      'blaze',
      'chlorophyll',
      'overgrow',
    ]);
    expect(await listAbilities(db, rb)).toEqual([]);
    expect(await listSpeciesTags(db)).toEqual(['starter']);
    expect(await listGameLanguages(db)).toEqual(['ja-Hrkt', 'en', 'pt-BR']);
  });
});

describe('profile (RF02)', () => {
  it('returns species data, EV yield, egg groups and game presence', async () => {
    const profile = await getPokemonProfile(db, 4, sv);
    expect(profile).toMatchObject({
      name: 'Charmander',
      nationalNumber: 4,
      regionalNumber: 150,
      inGame: true,
      baseExperience: 64,
      formName: null,
      evYield: { specialAttack: 1, speed: 0 },
      species: {
        generationId: 1,
        genderRate: 1,
        captureRate: 45,
        hatchCounter: 20,
        growthRate: { identifier: 'medium', name: 'medium' },
        tags: ['starter'],
      },
    });
    expect(profile?.species.eggGroups.map((e) => e.name)).toEqual(['Monster', 'Dragon']);
    expect((await getPokemonProfile(db, 4, rb))?.regionalNumber).toBe(4);
    expect((await getPokemonProfile(db, 935, rb))?.inGame).toBe(false);
    expect(await getPokemonProfile(db, 99999, rb)).toBeNull();
  });

  it('lists Pokédex entries per version, flagging other games', async () => {
    const red = await getFlavorTexts(db, 25, rb);
    expect(red.map((entry) => [entry.versionName, entry.inGame])).toEqual([
      ['Red', true],
      ['Blue', true],
    ]);
    expect(red[0]?.text).toMatch(/^When several of these POKéMON gather/);
    expect((await getFlavorTexts(db, 25, sv)).every((entry) => !entry.inGame)).toBe(true);
  });

  it('describes abilities with clean prose and the game-appropriate flavor text', async () => {
    const overgrow = await getAbilityDetail(db, 65, sv);
    expect(overgrow).toMatchObject({
      name: 'Overgrow',
      shortEffect: 'Strengthens grass moves to 1.5× in a pinch.',
      flavorText: 'Powers up Grass-type moves when the Pokémon’s HP is low.',
    });
    expect(overgrow?.effect).toContain('1/3 or less of its HP remaining');
    const dp = await resolveGameContext(db, 'diamond-pearl', ['en']);
    expect((await getAbilityDetail(db, 65, dp))?.flavorText).toBe('Ups GRASS moves in a pinch.');
    expect(await getAbilityDetail(db, 999, dp)).toBeNull();
  });
});

describe('evolution and forms (RF02.5)', () => {
  it('builds the chain breadth-first with methods valid in the game', async () => {
    const red = await getEvolutionChain(db, 6, rb);
    expect(red?.nodes.map((n) => [n.name, n.evolvesFromSpeciesId])).toEqual([
      ['Charmander', null],
      ['Charmeleon', 4],
      ['Charizard', 5],
    ]);
    expect(red?.nodes[1]?.methods).toEqual([
      expect.objectContaining({ trigger: 'level-up', triggerName: 'Level up', minLevel: 16 }),
    ]);
    // The newer method supersedes the old one from Scarlet/Violet on.
    const scarlet = await getEvolutionChain(db, 5, sv);
    expect(scarlet?.nodes[1]?.methods).toEqual([
      expect.objectContaining({
        trigger: 'use-item',
        item: expect.objectContaining({ name: 'Potion' }),
      }),
    ]);
    expect(scarlet?.nodes.map((n) => n.inGame)).toEqual([true, false, true]);
    expect(await getEvolutionChain(db, 99999, sv)).toBeNull();
  });

  it('lists varieties with their form kind and change item', async () => {
    const forms = await getPokemonForms(db, 6, sv);
    expect(forms.varieties.map((v) => [v.name, v.formKind, v.inGame])).toEqual([
      ['Charizard', 'default', true],
      ['Mega Charizard X', 'mega', true],
    ]);
    expect(forms.varieties[1]?.change).toMatchObject({
      kind: 'mega',
      item: { identifier: 'charizardite-x' },
    });
    expect(forms.cosmeticForms).toEqual([]);
  });
});

describe('moveset (RF02.6)', () => {
  it('merges DLC version groups and labels machines', async () => {
    const red = await getPokemonMoves(db, 25, rb);
    expect(red.moves).toEqual([
      expect.objectContaining({
        tab: 'machine',
        name: 'Thunderbolt',
        type: 'electric',
        damageClass: 'special',
        power: 90,
        machine: 'TM24',
      }),
    ]);
    const scarlet = await getPokemonMoves(db, 25, sv);
    expect(scarlet.moves.map((m) => [m.tab, m.identifier, m.level])).toEqual([
      ['level-up', 'pound', 1],
      ['machine', 'bite', 0],
      ['machine', 'thunderbolt', 0],
    ]);
    expect(scarlet.inheritedFromPokemonId).toBeNull();
  });

  it('falls back to the base variety for forms without a learnset', async () => {
    const mega = await getPokemonMoves(db, 10034, sv);
    expect(mega.inheritedFromPokemonId).toBe(6);
    expect(mega.moves.map((m) => [m.tab, m.identifier])).toEqual([['level-up', 'flamethrower']]);
    expect((await getPokemonMoves(db, 6, rb)).moves).toEqual([]);
  });
});

describe('encounters (RF02.7)', () => {
  it('sums slots, merges identical versions and resolves conditions', async () => {
    const encounters = await getPokemonEncounters(db, 25, rb);
    expect(encounters).toEqual([
      expect.objectContaining({
        location: expect.objectContaining({ name: 'Viridian Forest' }),
        areaName: null,
        method: expect.objectContaining({ identifier: 'walk' }),
        minLevel: 3,
        maxLevel: 5,
        ratePct: 5,
        conditions: [],
        versions: [
          expect.objectContaining({ name: 'Red' }),
          expect.objectContaining({ name: 'Blue' }),
        ],
      }),
      expect.objectContaining({
        minLevel: 4,
        maxLevel: 6,
        ratePct: 10,
        conditions: [expect.objectContaining({ identifier: 'time-night', name: 'At night' })],
        versions: [expect.objectContaining({ name: 'Red' })],
      }),
    ]);
    expect(await getPokemonEncounters(db, 25, sv)).toEqual([]);
  });
});

describe('media (RNF02)', () => {
  it('maps pinned directory listings to Pokémon assets and download URLs', async () => {
    const sources = await getMediaSources(db);
    expect(sources).toHaveLength(10);
    const official = sources.find((s) => s.style === 'official' && s.variant === 'shiny')!;
    expect(official.baseUrl).toBe(
      `https://raw.githubusercontent.com/PokeAPI/sprites/${SPRITES_SHA}/sprites/pokemon/other/official-artwork/shiny`,
    );
    const pikachu = await getPokemonMedia(db, 25);
    expect(pikachu).toHaveLength(10);
    const shiny = pikachu.find((a) => a.style === 'official' && a.variant === 'shiny')!;
    expect(mediaUrl(official, shiny)).toMatch(/\/official-artwork\/shiny\/25\.png$/);
    expect(mediaCacheKey(shiny)).toBe('official/shiny/25');
    expect((await getPokemonMedia(db, 10034)).map((a) => a.style)).not.toContain('3d');
    expect((await listMediaAssets(db, ['cry'])).map((a) => a.path)).toEqual([
      '6.ogg',
      '6.ogg',
      '25.ogg',
      '25.ogg',
      '10034.ogg',
      '10034.ogg',
    ]);
    expect(await getMediaPackSizes(db)).toContainEqual({ style: 'pixel', files: 6, bytes: 12000 });
  });

  it('tracks downloaded files in the user DB media_cache', async () => {
    const entry = {
      key: 'official/default/25',
      kind: 'official',
      url: 'https://example.invalid/25.png',
      localUri: 'file:///media/official/default/25.png',
      bytes: 1000,
      etag: null,
      fetchedAt: 1,
      lastAccessAt: 1,
    };
    await putMediaCacheEntry(db, entry);
    await putMediaCacheEntry(db, { ...entry, key: 'cry/latest/25', kind: 'cry', bytes: 50 });
    await touchMediaCacheEntry(db, entry.key, 5);
    expect(await getMediaCacheEntry(db, entry.key)).toEqual({ ...entry, lastAccessAt: 5 });
    expect(await listMediaCacheKeys(db, 'cry')).toEqual(new Set(['cry/latest/25']));
    expect(await getMediaCacheStats(db)).toEqual({ files: 2, bytes: 1050 });
    await deleteMediaCacheEntries(db, ['cry/latest/25']);
    await deleteMediaCacheEntries(db, []);
    expect(await listMediaCacheKeys(db)).toEqual(new Set([entry.key]));
    await deleteMediaCacheEntries(db);
    expect(await getMediaCacheEntry(db, entry.key)).toBeNull();
  });
});
