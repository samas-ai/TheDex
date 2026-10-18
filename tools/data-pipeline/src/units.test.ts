import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCurated } from './curated';
import { itemGroup } from './derive/items';
import { locationKind } from './derive/locations';
import { zBoostsJson } from './derive/pkmn';
import { LanguageMap } from './lang';
import { scanViolations } from './query-plans';
import { cleanFlavorText } from './text';
import { toBool, toInt, toIntRequired, toPsId, toText } from './values';

describe('CSV value coercion', () => {
  it('parses integers strictly', () => {
    expect(toInt('42')).toBe(42);
    expect(toInt('-1')).toBe(-1);
    expect(toInt('')).toBeNull();
    expect(toInt(undefined)).toBeNull();
    expect(() => toInt('1.5')).toThrow(/integer/);
    expect(() => toIntRequired('', 'id')).toThrow(/id/);
  });

  it('parses booleans and text', () => {
    expect(toBool('1')).toBe(1);
    expect(toBool('0')).toBe(0);
    expect(toBool('')).toBe(0);
    expect(toBool('False')).toBe(0);
    expect(toText('  hi ')).toBe('hi');
    expect(toText('   ')).toBeNull();
  });

  it('derives Showdown IDs', () => {
    expect(toPsId('Mr. Mime')).toBe('mrmime');
    expect(toPsId('charizard-mega-x')).toBe('charizardmegax');
    expect(toPsId("Farfetch'd")).toBe('farfetchd');
  });
});

describe('cleanFlavorText', () => {
  it('joins soft-hyphenated words and collapses breaks', () => {
    expect(cleanFlavorText('Pounds with fore­\nlegs or\ftail.')).toBe(
      'Pounds with forelegs or tail.',
    );
    expect(cleanFlavorText('A self-\ndestruct  move')).toBe('A self-destruct move');
  });
});

describe('LanguageMap', () => {
  it('maps PokeAPI language ids to BCP-47 and rejects unknown identifiers', () => {
    const map = new LanguageMap([
      { id: '1', identifier: 'ja-hrkt' },
      { id: '13', identifier: 'pt-br' },
    ]);
    expect(map.code('1')).toBe('ja-Hrkt');
    expect(map.code('13')).toBe('pt-BR');
    expect(map.code('99')).toBeNull();
    expect(map.code('')).toBeNull();
    expect(() => new LanguageMap([{ id: '50', identifier: 'tlh' }])).toThrow(/Unmapped/);
  });
});

describe('scanViolations', () => {
  it('flags full scans of large tables only', () => {
    expect(
      scanViolations([
        'SCAN f VIRTUAL TABLE INDEX 0:L0',
        'SEARCH t USING INTEGER PRIMARY KEY (rowid=?)',
        'SCAN best',
        'SCAN games',
        'SCAN pm',
        'SCAN pokemon_moves USING COVERING INDEX pokemon_moves_move_idx',
      ]),
    ).toEqual(['SCAN pm', 'SCAN pokemon_moves USING COVERING INDEX pokemon_moves_move_idx']);
  });
});

describe('loadCurated', () => {
  it('reports schema errors with the file name', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'thedex-curated-'));
    try {
      writeFileSync(path.join(dir, 'games.json'), JSON.stringify({ games: [{ identifier: 'x' }] }));
      expect(() => loadCurated(dir)).toThrow(/games\.json/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('itemGroup (RF05.1)', () => {
  it('groups by category first, then by bag pocket', () => {
    expect(itemGroup('mega-stones', 'misc')).toBe('held');
    expect(itemGroup('stat-boosts', 'battle')).toBe('held');
    expect(itemGroup('evolution', 'misc')).toBe('evolution');
    expect(itemGroup('dex-completion', 'misc')).toBe('treasure');
    expect(itemGroup('healing', 'medicine')).toBe('medicine');
    expect(itemGroup('standard-balls', 'pokeballs')).toBe('ball');
    expect(itemGroup('in-a-pinch', 'berries')).toBe('berry');
    expect(itemGroup('all-machines', 'machines')).toBe('machine');
    expect(itemGroup('plot-advancement', 'key')).toBe('key');
    expect(itemGroup('unused', 'key')).toBe('other');
    expect(itemGroup('picnic', 'misc')).toBe('other');
  });
});

describe('locationKind (RF06.1)', () => {
  it('classifies by identifier words, curated overrides first', () => {
    expect(locationKind('celadon-city')).toBe('city');
    expect(locationKind('hauoli-city--beachfront')).toBe('city');
    expect(locationKind('kanto-route-1')).toBe('route');
    expect(locationKind('kanto-sea-route-19')).toBe('route');
    expect(locationKind('paldea-south-province-area-one')).toBe('route');
    expect(locationKind('kanto-victory-road-1')).toBe('cave');
    expect(locationKind('mt-moon')).toBe('cave');
    expect(locationKind('lake-verity')).toBe('water');
    expect(locationKind('verity-lakefront')).toBe('area');
    expect(locationKind('pokemon-tower')).toBe('building');
    expect(locationKind('nacrene-gate')).toBe('building');
    expect(locationKind('viridian-forest')).toBe('area');
    expect(locationKind('mesagoza')).toBe('area');
    expect(locationKind('mesagoza', { mesagoza: 'city' })).toBe('city');
  });
});

describe('zBoostsJson', () => {
  it('maps Showdown boosts to stat identifiers', () => {
    expect(zBoostsJson({ spe: 1 })).toBe('{"speed":1}');
    expect(zBoostsJson({ atk: 1, def: 1, spa: 1, spd: 1, spe: 1 })).toBe(
      '{"attack":1,"defense":1,"special-attack":1,"special-defense":1,"speed":1}',
    );
    expect(zBoostsJson({ evasion: 1, accuracy: 0 })).toBe('{"evasion":1}');
    expect(zBoostsJson(undefined)).toBeNull();
    expect(zBoostsJson({})).toBeNull();
  });
});
