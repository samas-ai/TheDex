import { describe, expect, it } from 'vitest';
import type { EvolutionMethod, EvolutionNode, LearnsetMove } from '@thedex/db';
import { describeEvolutionMethod, evolutionStages, movesByTab, statRows } from './profile-logic';

const method = (patch: Partial<EvolutionMethod>): EvolutionMethod => ({
  trigger: 'level-up',
  triggerName: 'Level up',
  minLevel: null,
  item: null,
  heldItem: null,
  gender: null,
  location: null,
  timeOfDay: null,
  knownMove: null,
  knownMoveType: null,
  minHappiness: null,
  minBeauty: null,
  minAffection: null,
  relativePhysicalStats: null,
  partySpecies: null,
  partyType: null,
  tradeSpecies: null,
  usedMove: null,
  minMoveCount: null,
  minSteps: null,
  minDamageTaken: null,
  needsOverworldRain: false,
  turnUpsideDown: false,
  needsMultiplayer: false,
  nearSpecialRock: false,
  region: null,
  evolvedPokemon: null,
  requiredPokemon: null,
  versionGroupId: 1,
  ...patch,
});

/** Echoes keys and options so assertions read like the template. */
const t = (key: string, options?: Record<string, unknown>) =>
  `${key.replace('profile.evolution.method.', '')}${options ? JSON.stringify(options) : ''}`;

const named = (name: string) => ({ id: 1, identifier: name.toLowerCase(), name });

describe('statRows (RF02.4)', () => {
  const charizard = {
    hp: 78,
    attack: 84,
    defense: 78,
    specialAttack: 109,
    specialDefense: 85,
    speed: 100,
    special: null,
    bst: 534,
  };

  it('computes Lv. 50/100 ranges for the six stats', () => {
    const rows = statRows(charizard, 9);
    expect(rows.map((r) => r.stat)).toEqual([
      'hp',
      'attack',
      'defense',
      'special-attack',
      'special-defense',
      'speed',
    ]);
    expect(rows[0]).toEqual({
      stat: 'hp',
      base: 78,
      lv50: { min: 138, max: 185 },
      lv100: { min: 266, max: 360 },
    });
    expect(rows[5]?.lv100).toEqual({ min: 184, max: 328 });
  });

  it('uses the unified Special in Gen 1', () => {
    const rows = statRows({ ...charizard, special: 85 }, 1);
    expect(rows.map((r) => r.stat)).toEqual(['hp', 'attack', 'defense', 'special', 'speed']);
    expect(rows[3]?.base).toBe(85);
    expect(statRows(charizard, 1)[3]?.base).toBe(109);
  });
});

describe('describeEvolutionMethod (RF02.5)', () => {
  it('describes level, item, trade and friendship methods', () => {
    expect(describeEvolutionMethod(method({ minLevel: 16 }), t)).toBe('level{"level":16}');
    expect(
      describeEvolutionMethod(method({ trigger: 'use-item', item: named('Water Stone') }), t),
    ).toBe('useItem{"item":"Water Stone"}');
    expect(
      describeEvolutionMethod(
        method({
          trigger: 'trade',
          heldItem: named('Metal Coat'),
          tradeSpecies: named('Karrablast'),
        }),
        t,
      ),
    ).toBe('trade, tradeFor{"species":"Karrablast"}, holding{"item":"Metal Coat"}');
    expect(describeEvolutionMethod(method({ minHappiness: 160, timeOfDay: 'day' }), t)).toBe(
      'levelUp, friendship{"value":160}, timeOfDay.day',
    );
  });

  it('describes every extra condition', () => {
    const text = describeEvolutionMethod(
      method({
        trigger: 'spin',
        triggerName: 'Spin',
        minLevel: 5,
        item: named('Strawberry Sweet'),
        minAffection: 2,
        minBeauty: 170,
        knownMove: named('Mimic'),
        knownMoveType: named('Fairy'),
        nearSpecialRock: true,
        gender: 'female',
        needsOverworldRain: true,
        turnUpsideDown: true,
        needsMultiplayer: true,
        partySpecies: named('Remoraid'),
        partyType: named('Dark'),
        relativePhysicalStats: 1,
        usedMove: named('Rage Fist'),
        minMoveCount: 20,
        minSteps: 1000,
        minDamageTaken: 49,
        region: named('Alola'),
        evolvedPokemon: { id: 10100, name: 'Alolan Raichu' },
      }),
      t,
    );
    expect(text.split(', ')).toEqual([
      'Spin',
      'level{"level":5}',
      'useItem{"item":"Strawberry Sweet"}',
      'affection{"value":2}',
      'beauty{"value":170}',
      'knownMove{"move":"Mimic"}',
      'knownMoveType{"type":"Fairy"}',
      'nearRock',
      'female',
      'rain',
      'upsideDown',
      'multiplayer',
      'partySpecies{"species":"Remoraid"}',
      'partyType{"type":"Dark"}',
      'atkGtDef',
      'usedMove{"move":"Rage Fist","count":20}',
      'steps{"count":1000}',
      'damageTaken{"count":49}',
      'region{"region":"Alola"}',
      'becomes{"name":"Alolan Raichu"}',
    ]);
    expect(describeEvolutionMethod(method({ relativePhysicalStats: 0 }), t)).toContain('atkEqDef');
    expect(
      describeEvolutionMethod(
        method({ relativePhysicalStats: -1, location: named('Route 20') }),
        t,
      ),
    ).toBe('levelUp, at{"location":"Route 20"}, atkLtDef');
  });
});

describe('evolutionStages', () => {
  const node = (speciesId: number, from: number | null): EvolutionNode => ({
    speciesId,
    pokemonId: speciesId,
    name: String(speciesId),
    types: [],
    isBaby: false,
    inGame: true,
    evolvesFromSpeciesId: from,
    methods: [],
  });

  it('lays out linear and branched chains by depth', () => {
    expect(
      evolutionStages([node(4, null), node(5, 4), node(6, 5)]).map((s) =>
        s.map((n) => n.speciesId),
      ),
    ).toEqual([[4], [5], [6]]);
    expect(
      evolutionStages([node(133, null), node(134, 133), node(135, 133)]).map((s) => s.length),
    ).toEqual([1, 2]);
  });
});

describe('movesByTab (RF02.6)', () => {
  const move = (tab: LearnsetMove['tab'], machine: string | null, id: number): LearnsetMove => ({
    tab,
    method: tab,
    level: 0,
    moveId: id,
    identifier: `m${id}`,
    name: `M${id}`,
    type: 'normal',
    damageClass: 'physical',
    power: 40,
    accuracy: 100,
    pp: 35,
    machine,
  });

  it('drops empty tabs and orders machines numerically', () => {
    const tabs = movesByTab([
      move('machine', 'TM100', 1),
      move('machine', 'TM24', 2),
      move('machine', null, 3),
      move('level-up', null, 4),
    ]);
    expect(tabs.map(([tab]) => tab)).toEqual(['level-up', 'machine']);
    expect(tabs[1]?.[1].map((m) => m.machine)).toEqual(['TM24', 'TM100', null]);
  });
});
