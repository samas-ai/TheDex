import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  checklistScope,
  decodeTeamMembers,
  deleteMediaCacheEntries,
  deleteTeam,
  getChecklistEntries,
  getChecklistFlags,
  getEntityNames,
  getMoveSummaries,
  getShowdownNames,
  getTeam,
  listChecklistDex,
  listTeams,
  natureFromShowdown,
  newTeamMember,
  nextTeamSortOrder,
  resolveShowdownNames,
  saveTeam,
  setChecklistEntries,
  getAbilityDetail,
  getAbilityHolders,
  getEvolutionChain,
  getFlavorTexts,
  getGameFeatures,
  getItemDetail,
  getItemIcon,
  getLearnableMoveIds,
  getLocation,
  getLocationEncounters,
  getMediaCacheEntry,
  getMediaCacheStats,
  getMediaPackSizes,
  getMediaSources,
  getMoveDetail,
  getMoveLearners,
  getPokemonEncounters,
  getPokemonForms,
  getPokemonMedia,
  getPokemonMoves,
  getPokemonProfile,
  itemIconCacheKey,
  itemIconSource,
  listAbilities,
  listAbilityDex,
  listDamageClasses,
  listEggGroups,
  listGameLanguages,
  listGenerations,
  listGmaxMoves,
  listItemIcons,
  listItems,
  listLocationRegions,
  listLocations,
  listMediaAssets,
  listMediaCacheKeys,
  listMoves,
  listNatures,
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
import { MEDIA_PACKS, SPRITES_SHA } from '../src/config';
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
  writeFixtureMediaListing(path.join(tmp, 'media.json'), path.join(tmp, 'media-packs'));
  const report = buildDatabase({
    csvDir: path.join(tmp, 'csv'),
    curatedDir: path.join(tmp, 'curated'),
    mediaListingFile: path.join(tmp, 'media.json'),
    mediaPackDir: path.join(tmp, 'media-packs'),
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
      overworldEffect: null,
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

  it('adds the base variety and pre-evolutions to the legal moves (RF08.2)', async () => {
    // Bite learned by Charmander only (level 5) in Scarlet/Violet.
    app.exec(`INSERT INTO data.pokemon_moves (pokemon_id, version_group_id, method_id, move_id, level)
      VALUES (4, 25, 1, 44, 5)`);
    try {
      expect([...(await getLearnableMoveIds(db, 6, sv))].sort()).toEqual([44, 53]);
      expect([...(await getLearnableMoveIds(db, 10034, sv))].sort()).toEqual([44, 53]);
      expect([...(await getLearnableMoveIds(db, 25, sv))].sort((a, b) => a - b)).toEqual([
        1, 44, 85,
      ]);
      expect([...(await getLearnableMoveIds(db, 6, rb))]).toEqual([]);
    } finally {
      app.exec('DELETE FROM data.pokemon_moves WHERE pokemon_id = 4 AND move_id = 44');
    }
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
    expect(sources).toHaveLength(13);
    const official = sources.find((s) => s.style === 'official' && s.variant === 'shiny')!;
    expect(official.baseUrl).toBe(
      `https://raw.githubusercontent.com/PokeAPI/sprites/${SPRITES_SHA}/sprites/pokemon/other/official-artwork/shiny`,
    );
    const pikachu = await getPokemonMedia(db, 25);
    expect(pikachu).toHaveLength(12);
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
    // iOS cries: the same files transcoded to AAC, served from the TheDex-hosted pack.
    const aac = sources.find((s) => s.style === 'cry-aac' && s.variant === 'legacy')!;
    expect(aac).toEqual({
      style: 'cry-aac',
      variant: 'legacy',
      baseUrl: `${MEDIA_PACKS['cries-aac'].baseUrl}/cries/pokemon/legacy`,
      format: 'm4a',
    });
    expect((await listMediaAssets(db, ['cry-aac'])).map((a) => a.path)).toEqual([
      '6.m4a',
      '6.m4a',
      '25.m4a',
      '25.m4a',
      '10034.m4a',
      '10034.m4a',
    ]);
    expect(await getMediaPackSizes(db)).toContainEqual({ style: 'pixel', files: 6, bytes: 12000 });
    // Item icons (RF05.2): `<identifier>.png` files of known items.
    expect(await getMediaPackSizes(db)).toContainEqual({ style: 'item', files: 2, bytes: 500 });
    expect(await getItemIcon(db, 17)).toEqual({ itemId: 17, path: 'potion.png', bytes: 300 });
    expect(await getItemIcon(db, 132)).toBeNull();
    expect((await listItemIcons(db)).map((icon) => icon.itemId)).toEqual([17, 328]);
    expect(itemIconSource(sources)?.baseUrl).toBe(
      `https://raw.githubusercontent.com/PokeAPI/sprites/${SPRITES_SHA}/sprites/items`,
    );
    expect(itemIconCacheKey(17)).toBe('item/default/17');
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

describe('game features', () => {
  it('reports data coverage and mechanics', async () => {
    expect(await getGameFeatures(db, sv)).toEqual({
      hasLearnsets: true,
      hasEncounters: false,
      hasMega: true,
      hasZ: false,
      hasDynamax: false,
      hasTera: true,
    });
    expect(await getGameFeatures(db, rb)).toMatchObject({
      hasLearnsets: true,
      hasEncounters: true,
      hasTera: false,
    });
    const gs = await resolveGameContext(db, 'gold-silver', ['en']);
    expect(await getGameFeatures(db, gs)).toMatchObject({
      hasLearnsets: false,
      hasEncounters: false,
    });
  });
});

describe('Move Dex (RF03)', () => {
  const ids = async (ctx: GameContext, query: Parameters<typeof listMoves>[2]) =>
    (await listMoves(db, ctx, query)).map((move) => move.identifier);

  it('lists the moves of the game generation with filters and sorts', async () => {
    const all = await listMoves(db, sv);
    expect(all.map((move) => move.name)).toEqual([
      'Bite',
      'Flamethrower',
      'karate-chop',
      'pound',
      'Thunderbolt',
    ]);
    expect(all[0]).toMatchObject({ type: 'dark', damageClass: 'physical', power: 60, pp: 25 });
    expect(await ids(sv, { filters: { learnableOnly: true } })).toEqual([
      'bite',
      'flamethrower',
      'pound',
      'thunderbolt',
    ]);
    expect(await ids(sv, { filters: { damageClasses: ['special'] } })).toEqual([
      'flamethrower',
      'thunderbolt',
    ]);
    expect(await ids(sv, { filters: { typeIds: [17, 13] } })).toEqual(['bite', 'thunderbolt']);
    expect(await ids(sv, { filters: { generationIds: [2] } })).toEqual([]);
    // Red/Blue: Bite was Normal-type, and the category came from the type.
    expect((await listMoves(db, rb)).find((move) => move.id === 44)).toMatchObject({
      type: 'normal',
      damageClass: 'physical',
    });
    expect(
      await ids(rb, { filters: { typeIds: [10] }, sort: { key: 'power', direction: 'desc' } }),
    ).toEqual(['flamethrower']);
    expect((await ids(sv, { sort: { key: 'pp', direction: 'asc' } }))[0]).toBe('flamethrower');
  });

  it('describes a move for the game, with effect chance, machine and Max/Z data', async () => {
    const bite = await getMoveDetail(db, 44, sv);
    expect(bite).toMatchObject({
      name: 'Bite',
      inGame: true,
      stats: { type: 'dark', damageClass: 'physical', power: 60, pp: 25, maxPp: 40 },
      shortEffect: 'Has a 30% chance to make the target flinch.',
      effect: 'Inflicts regular damage. Has a 30% chance to make the target flinch.',
      machine: null,
      variantOf: [],
    });
    expect(bite?.flags.map((flag) => flag.identifier)).toContain('contact');
    const thunderbolt = await getMoveDetail(db, 85, rb);
    expect(thunderbolt?.machine).toEqual({ label: 'TM24', itemId: 328 });
    expect(thunderbolt?.zMove).toMatchObject({ power: 175, move: null, signatures: [] });
    expect(thunderbolt?.maxMove).toMatchObject({ power: 130, move: null });
    expect(thunderbolt?.maxMove?.gmax.map((move) => move.name)).toEqual([
      'G-Max Stun Shock',
      'G-Max Volt Crash',
    ]);
    expect(await getMoveDetail(db, 9999, sv)).toBeNull();
  });

  it('lists G-Max Moves by type', async () => {
    const fire = await listGmaxMoves(db, sv, 10);
    expect(fire.map((move) => move.name)).toContain('G-Max Wildfire');
    expect(fire.every((move) => move.type === 'fire')).toBe(true);
    expect(fire.find((move) => move.psId === 'gmaxfireball')?.power).toBe(160);
  });

  it('lists who learns a move in the game, and how (RF03.3)', async () => {
    expect(await getMoveLearners(db, 85, sv)).toEqual([
      {
        pokemonId: 25,
        speciesId: 25,
        name: 'Pikachu',
        isDefault: true,
        types: ['electric'],
        inGame: true,
        methods: [{ tab: 'machine', method: 'machine', level: 0 }],
      },
    ]);
    const flamethrower = await getMoveLearners(db, 53, sv);
    expect(flamethrower.map((l) => [l.name, l.methods[0]?.level])).toEqual([
      ['Charmander', 20],
      ['Charizard', 1],
      ['Charcadet', 15],
    ]);
    expect(await getMoveLearners(db, 2, sv)).toEqual([]);
  });

  it('names move categories', async () => {
    const classes = await listDamageClasses(db, { langChain: ['pt-BR', 'en'] });
    expect(classes.map((d) => d.name)).toEqual(['status', 'Físico', 'Especial']);
  });
});

describe('Ability Dex (RF04)', () => {
  it('lists the abilities of the generation, optionally only those in the game', async () => {
    const all = await listAbilityDex(db, sv);
    expect(all.map((a) => a.name)).toEqual(['blaze', 'Chlorophyll', 'Overgrow']);
    expect(all[2]?.shortEffect).toBe('Strengthens grass moves to 1.5× in a pinch.');
    const inGame = await listAbilityDex(db, sv, { inGameOnly: true });
    expect(inGame.map((a) => a.name)).toEqual(['blaze']);
    expect(await listAbilityDex(db, rb)).toEqual([]);
  });

  it('shows the effect outside battle, curated first, else from the PokeAPI prose', async () => {
    const ptBr = await resolveGameContext(db, 'scarlet-violet', ['pt-BR']);
    expect((await getAbilityDetail(db, 66, ptBr))?.overworldEffect).toBe(
      'Um efeito de campo fictício.',
    );
    expect(await getAbilityDetail(db, 34, sv)).toMatchObject({
      effect: 'Doubles Speed during strong sunlight.',
      overworldEffect: 'A fictional field effect.',
    });
  });

  it('lists holders as regular or hidden ability (RF04.2)', async () => {
    expect(await getAbilityHolders(db, 34, sv)).toEqual([
      {
        pokemonId: 1,
        speciesId: 1,
        name: 'Bulbasaur',
        isDefault: true,
        types: ['grass', 'poison'],
        isHidden: true,
        inGame: false,
      },
    ]);
    const blaze = await getAbilityHolders(db, 66, sv);
    expect(blaze.map((h) => [h.name, h.isHidden, h.inGame])).toEqual([['Charmander', false, true]]);
    const dp = await resolveGameContext(db, 'diamond-pearl', ['en']);
    expect(await getAbilityHolders(db, 34, dp)).toEqual([]);
  });
});

describe('Item Dex (RF05)', () => {
  it('lists items by group, restricted to the game when asked', async () => {
    expect((await listItems(db, sv)).map((item) => [item.identifier, item.group])).toEqual([
      ['charizardite-x', 'held'],
      ['oran-berry', 'berry'],
      ['tm24', 'machine'],
      ['potion', 'medicine'],
    ]);
    const inGame = await listItems(db, sv, { inGameOnly: true });
    expect(inGame.map((item) => item.identifier)).toEqual(['oran-berry', 'potion']);
    expect(await listItems(db, rb, { groups: ['machine'], inGameOnly: true })).toEqual([
      {
        id: 328,
        identifier: 'tm24',
        name: 'TM24',
        group: 'machine',
        category: 'all-machines',
        cost: 3000,
        machineMove: { id: 85, name: 'Thunderbolt', type: 'electric' },
      },
    ]);
  });

  it('describes items: prices, Fling, flags, berries, evolutions and form changes', async () => {
    expect(await getItemDetail(db, 132, sv)).toMatchObject({
      name: 'Oran Berry',
      group: 'berry',
      category: { identifier: 'medicine' },
      pocket: { identifier: 'berries' },
      cost: 80,
      flingPower: 10,
      flingEffect: 'Activates the berry’s effect.',
      flags: [{ identifier: 'holdable', description: 'Can be held by a Pokémon' }],
      inGame: true,
      berry: {
        firmness: { name: 'Super Hard' },
        naturalGiftPower: 60,
        naturalGiftType: 'poison',
        flavors: [{ flavor: { identifier: 'spicy', name: 'Spicy' }, potency: 10 }],
      },
    });
    expect(await getItemDetail(db, 17, sv)).toMatchObject({
      shortEffect: 'Restores 20 HP.',
      evolutions: [{ pokemonId: 5, name: 'Charmeleon', held: false }],
      berry: null,
      locations: [],
    });
    const megaStone = await getItemDetail(db, 660, sv);
    expect(megaStone?.formChanges).toEqual([
      { pokemonId: 10034, name: 'Mega Charizard X', from: { pokemonId: 6, name: 'Charizard' } },
    ]);
    expect(megaStone?.inGame).toBe(false);
    // A TM's prose names some other game's move: the game's machine move replaces it.
    expect(await getItemDetail(db, 328, rb)).toMatchObject({
      shortEffect: null,
      machine: { label: 'TM24', move: { id: 85, name: 'Thunderbolt', type: 'electric' } },
    });
    expect(await getItemDetail(db, 9999, sv)).toBeNull();
  });
});

describe('Location Dex (RF06)', () => {
  it('lists regions and their locations by group, flagging the game’s', async () => {
    expect(await listLocationRegions(db, rb)).toEqual([
      { id: 1, identifier: 'kanto', name: 'kanto', inGame: true },
    ]);
    expect((await listLocationRegions(db, sv))[0]?.inGame).toBe(false);
    const kanto = await listLocations(db, rb, { regionId: 1 });
    expect(kanto.map((l) => [l.name, l.kind, l.inGame, l.hasEncounters])).toEqual([
      ['Cinnabar Island', 'city', false, false],
      ['Pallet Town', 'city', true, false],
      ['Viridian Forest', 'area', true, true],
    ]);
    const inGame = await listLocations(db, rb, { regionId: 1, inGameOnly: true });
    expect(inGame.map((l) => l.name)).toEqual(['Pallet Town', 'Viridian Forest']);
    expect(await listLocations(db, sv, { regionId: 1, inGameOnly: true })).toEqual([]);
  });

  it('describes a location and its encounters per area (RF06.2)', async () => {
    expect(await getLocation(db, 155, rb)).toMatchObject({
      name: 'Viridian Forest',
      kind: 'area',
      region: { identifier: 'kanto' },
      inGame: true,
      hasEncounters: true,
    });
    expect(await getLocation(db, 9999, rb)).toBeNull();
    const areas = await getLocationEncounters(db, 155, rb);
    expect(areas).toHaveLength(1);
    expect(areas[0]).toMatchObject({ areaId: 321, areaName: null });
    expect(areas[0]?.encounters).toEqual([
      expect.objectContaining({
        pokemon: { id: 25, speciesId: 25, name: 'Pikachu', types: ['electric'] },
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
        conditions: [expect.objectContaining({ identifier: 'time-night' })],
        versions: [expect.objectContaining({ name: 'Red' })],
      }),
    ]);
    expect(await getLocationEncounters(db, 155, sv)).toEqual([]);
  });
});

describe('Nature Dex (RF07.2)', () => {
  it('lists natures with raised/lowered stats and flavors (neutral ones have none)', async () => {
    expect(await listNatures(db, { langChain: ['pt-BR', 'en'] })).toEqual([
      {
        id: 1,
        identifier: 'hardy',
        name: 'hardy',
        increased: null,
        decreased: null,
        likes: null,
        hates: null,
        gameIndex: 0,
      },
      {
        id: 3,
        identifier: 'adamant',
        name: 'Firme',
        increased: { id: 2, identifier: 'attack', name: 'attack' },
        decreased: { id: 4, identifier: 'special-attack', name: 'Atq. Esp.' },
        likes: { id: 1, identifier: 'spicy', name: 'Spicy' },
        hates: { id: 4, identifier: 'bitter', name: 'Bitter' },
        gameIndex: 3,
      },
    ]);
  });
});

describe('teams (RF08)', () => {
  const member = newTeamMember(25);

  it('creates slots with the Showdown defaults', () => {
    expect(member).toEqual({
      pokemonId: 25,
      nickname: '',
      level: 100,
      gender: '',
      shiny: false,
      abilityId: null,
      nature: null,
      itemId: null,
      teraType: null,
      moveIds: [],
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      happiness: 255,
      hpType: null,
      gigantamax: false,
      dynamaxLevel: 10,
    });
  });

  it('decodes stored members, dropping invalid ones', () => {
    expect(decodeTeamMembers('not json')).toEqual([]);
    expect(decodeTeamMembers('{"pokemonId":25}')).toEqual([]);
    const json = JSON.stringify([
      { pokemonId: 6, nature: 'adamant', teraType: 'stellar', moveIds: [53, null] },
      { pokemonId: 25, nature: 'grumpy' },
      { pokemonId: 4, evs: { hp: 300, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } },
      { pokemonId: 1, extra: 'ignored' },
    ]);
    const decoded = decodeTeamMembers(json);
    expect(decoded.map((m) => m.pokemonId)).toEqual([6, 1]);
    expect(decoded[0]).toMatchObject({
      nature: 'adamant',
      teraType: 'stellar',
      moveIds: [53, null],
    });
    expect(decoded[1]).not.toHaveProperty('extra');
    const seven = JSON.stringify(Array.from({ length: 7 }, (_, i) => ({ pokemonId: i + 1 })));
    expect(decodeTeamMembers(seven)).toHaveLength(6);
  });

  it('saves, lists, updates and tombstones teams', async () => {
    expect(await nextTeamSortOrder(db)).toBe(0);
    const base = {
      format: 'gen9ou',
      gameId: sv.gameId,
      generationId: 9,
      notes: null,
      createdAt: 1000,
    };
    await saveTeam(db, { ...base, id: 'B', name: 'Rain', members: [member], sortOrder: 0 }, 2000);
    await saveTeam(db, { ...base, id: 'A', name: 'Sun', members: [], sortOrder: 1 }, 2000);
    expect(await nextTeamSortOrder(db)).toBe(2);
    expect((await listTeams(db)).map((team) => team.name)).toEqual(['Rain', 'Sun']);

    await saveTeam(
      db,
      { ...base, id: 'A', name: 'Sun 2', members: [member, member], sortOrder: 1 },
      3000,
    );
    expect(await getTeam(db, 'A')).toMatchObject({
      name: 'Sun 2',
      updatedAt: 3000,
      members: [member, member],
    });

    await deleteTeam(db, 'A', 4000);
    expect(await getTeam(db, 'A')).toBeNull();
    expect((await listTeams(db)).map((team) => team.id)).toEqual(['B']);
    expect(app.prepare(`SELECT deleted_at, updated_at FROM teams WHERE id = 'A'`).get()).toEqual({
      deleted_at: 4000,
      updated_at: 4000,
    });
    // Saving the id again brings it back.
    await saveTeam(db, { ...base, id: 'A', name: 'Sun 3', members: [], sortOrder: 1 }, 5000);
    expect((await getTeam(db, 'A'))?.name).toBe('Sun 3');

    const seven = Array.from({ length: 7 }, () => member);
    await expect(
      saveTeam(db, { ...base, id: 'C', name: 'Too big', members: seven, sortOrder: 2 }, 1),
    ).rejects.toThrow(RangeError);
    await expect(
      saveTeam(
        db,
        { ...base, id: 'C', name: 'Bad', members: [{ ...member, level: 0 }], sortOrder: 2 },
        1,
      ),
    ).rejects.toThrow();
  });
});

describe('checklist (RF09)', () => {
  it('names collection scopes', () => {
    expect(checklistScope('national', 7)).toBe('national');
    expect(checklistScope('game', 7)).toBe('game:7');
  });

  it('lists every species for the National Dex and the regional dexes for a game', async () => {
    const national = await listChecklistDex(db, rb, 'national');
    expect(national.map((entry) => entry.number)).toEqual([1, 4, 5, 6, 25, 35, 81, 390, 737, 935]);
    expect(national.find((entry) => entry.speciesId === 81)).toMatchObject({
      pokemonId: 81,
      name: 'Magnemite',
      generationId: 1,
      types: ['electric'],
    });
    // Later species keep their own typing in an older game's context.
    expect(national.find((entry) => entry.speciesId === 390)).toMatchObject({
      generationId: 4,
      types: ['fire'],
    });
    const game = await listChecklistDex(db, sv, 'game');
    expect(game.map((entry) => [entry.name, entry.number])).toEqual([
      ['Charcadet', 26],
      ['Pikachu', 74],
      ['Charmander', 150],
      ['Charizard', 151],
    ]);
  });

  it('upserts entries in batches and reads them back', async () => {
    const scope = checklistScope('game', sv.gameId);
    const many = Array.from({ length: 450 }, (_, i) => ({
      pokemonId: 20000 + i,
      seen: true,
      caught: i % 2 === 0,
      shinyCaught: false,
    }));
    await setChecklistEntries(db, scope, many, 10);
    await setChecklistEntries(
      db,
      scope,
      [
        { pokemonId: 25, seen: true, caught: true, shinyCaught: true },
        { pokemonId: 20000, seen: false, caught: false, shinyCaught: false },
        { pokemonId: 25, formId: 5, seen: true, caught: false, shinyCaught: false },
      ],
      20,
    );
    const entries = await getChecklistEntries(db, scope);
    expect(entries).toHaveLength(452);
    expect(entries.find((e) => e.pokemonId === 25 && e.formId === 0)).toEqual({
      pokemonId: 25,
      formId: 0,
      seen: true,
      caught: true,
      shinyCaught: true,
    });
    expect(entries.find((e) => e.pokemonId === 20000)).toMatchObject({
      seen: false,
      caught: false,
    });
    const flags = await getChecklistFlags(db, scope, [25, 4, 20001]);
    expect([...flags.keys()].sort()).toEqual([20001, 25]);
    expect(flags.get(20001)).toEqual({ seen: true, caught: false, shinyCaught: false });
    expect(await getChecklistFlags(db, scope, [])).toEqual(new Map());
    // The Pokédex capture filter reads the same scope.
    expect(
      (await listPokedex(db, sv, { filters: { capture: { scope, status: 'shiny' } } })).map(
        (entry) => entry.name,
      ),
    ).toEqual(['Pikachu']);
  });
});

describe('team data and Showdown names (RF08.2, RF08.4)', () => {
  it('summarizes moves as of the game', async () => {
    const moves = await getMoveSummaries(db, sv, [85, 44, 85]);
    expect(moves.get(85)).toMatchObject({
      name: 'Thunderbolt',
      type: 'electric',
      damageClass: 'special',
    });
    expect(moves.get(44)).toMatchObject({ type: 'dark', damageClass: 'physical', power: 60 });
    expect((await getMoveSummaries(db, rb, [44])).get(44)).toMatchObject({ type: 'normal' });
    expect(await getMoveSummaries(db, sv, [])).toEqual(new Map());
  });

  it('names entities by id in the game languages', async () => {
    const names = async (kind: Parameters<typeof getEntityNames>[2], ids: number[]) =>
      Object.fromEntries(await getEntityNames(db, ['pt-BR', 'en'], kind, ids));
    expect(await names('pokemon', [10034, 25, 99999])).toEqual({
      10034: 'Mega Charizard X',
      25: 'Pikachu',
    });
    expect(await names('item', [17])).toEqual({ 17: 'Potion' });
    expect(await names('ability', [65, 66])).toEqual({ 65: 'Overgrow', 66: 'blaze' });
    expect(await names('move', [85])).toEqual({ 85: 'Thunderbolt' });
    expect(await names('move', [])).toEqual({});
  });

  it('resolves Showdown names to ids, cosmetic forms included', async () => {
    app.exec(`INSERT INTO data.pokemon_forms (id, identifier, ps_id, pokemon_id, form_identifier,
      form_kind, introduced_in_version_group_id, is_default, is_battle_only, is_mega, form_order,
      sort_order) VALUES (99999, 'pikachu-test', 'pikachutest', 25, 'test', 'cosmetic', 25, 0, 0, 0, 9, 9)`);
    try {
      const ids = await resolveShowdownNames(db, {
        species: ['Charizard-Mega-X', 'pikachu', 'Pikachu-Test', 'Missingno', ''],
        // Potion has no Showdown ID: it resolves through its identifier.
        items: ['Potion', 'Oran Berry', 'Leftovers'],
        abilities: ['Overgrow'],
        moves: ['Thunderbolt', 'Flamethrower'],
      });
      expect(Object.fromEntries(ids.pokemon)).toEqual({
        charizardmegax: 10034,
        pikachu: 25,
        pikachutest: 25,
      });
      expect(Object.fromEntries(ids.items)).toEqual({ potion: 17, oranberry: 132 });
      expect(Object.fromEntries(ids.abilities)).toEqual({ overgrow: 65 });
      expect(Object.fromEntries(ids.moves)).toEqual({ thunderbolt: 85, flamethrower: 53 });
      expect((await resolveShowdownNames(db, {})).pokemon.size).toBe(0);
    } finally {
      app.exec('DELETE FROM data.pokemon_forms WHERE id = 99999');
    }
  });

  it('gives Showdown display names for export', async () => {
    const names = await getShowdownNames(db, {
      pokemon: [10034, 25],
      items: [17, 328],
      abilities: [65],
      moves: [85],
    });
    expect(Object.fromEntries(names.pokemon)).toEqual({
      10034: 'Charizard-Mega-X',
      25: 'Pikachu',
    });
    // TMs are not Showdown items: the English name stands in.
    expect(Object.fromEntries(names.items)).toEqual({ 17: 'Potion', 328: 'TM24' });
    expect(Object.fromEntries(names.abilities)).toEqual({ 65: 'Overgrow' });
    expect(Object.fromEntries(names.moves)).toEqual({ 85: 'Thunderbolt' });
    expect((await getShowdownNames(db, {})).moves.size).toBe(0);
  });

  it('maps Showdown nature names', () => {
    expect(natureFromShowdown('Adamant')).toBe('adamant');
    expect(natureFromShowdown('Grumpy')).toBeNull();
  });
});
