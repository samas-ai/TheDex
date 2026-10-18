import { describe, expect, it } from 'vitest';
import type { MoveLearner, MoveMeta } from '@thedex/db';
import {
  describeMoveMeta,
  describeZBoosts,
  formatMoveValue,
  formatPriority,
  learnersByTab,
} from './move-format';

const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key;
const statName = (identifier: string) => identifier.toUpperCase();

const META: MoveMeta = {
  category: 'damage',
  ailment: null,
  minHits: null,
  maxHits: null,
  minTurns: null,
  maxTurns: null,
  drain: 0,
  healing: 0,
  critRate: 0,
  ailmentChance: 0,
  flinchChance: 0,
  statChance: 0,
  statChanges: [],
};

describe('move values', () => {
  it('formats missing values and priority signs', () => {
    expect(formatMoveValue(null)).toBe('—');
    expect(formatMoveValue(90)).toBe('90');
    expect(formatPriority(1)).toBe('+1');
    expect(formatPriority(0)).toBe('0');
    expect(formatPriority(-6)).toBe('−6');
  });
});

describe('describeMoveMeta (RF03.2)', () => {
  it('describes nothing for a plain damaging move', () => {
    expect(describeMoveMeta(META, t, statName)).toEqual([]);
  });

  it('describes hits, drain, recoil, healing, crits, ailments, flinch and stat changes', () => {
    expect(
      describeMoveMeta(
        {
          ...META,
          minHits: 2,
          maxHits: 5,
          drain: 50,
          critRate: 1,
          ailment: { id: 1, identifier: 'paralysis', name: 'Paralysis' },
          ailmentChance: 10,
          flinchChance: 30,
          statChanges: [{ stat: 'speed', change: -1 }],
          statChance: 100,
        },
        t,
        statName,
      ),
    ).toEqual([
      'move.meta.hits {"count":"2–5"}',
      'move.meta.drain {"value":50}',
      'move.meta.crit {"value":1}',
      'move.meta.ailmentChance {"chance":10,"ailment":"Paralysis"}',
      'move.meta.flinch {"chance":30}',
      'move.meta.statChanceChanges {"chance":100,"changes":"SPEED −1"}',
    ]);
    expect(
      describeMoveMeta(
        {
          ...META,
          minTurns: 2,
          maxTurns: 2,
          drain: -33,
          healing: -50,
          ailment: { id: 2, identifier: 'sleep', name: 'Sleep' },
          statChanges: [{ stat: 'attack', change: 2 }],
        },
        t,
        statName,
      ),
    ).toEqual([
      'move.meta.turns {"count":"2"}',
      'move.meta.recoil {"value":33}',
      'move.meta.hpCost {"value":50}',
      'move.meta.ailment {"ailment":"Sleep"}',
      'move.meta.statChanges {"changes":"ATTACK +2"}',
    ]);
    expect(describeMoveMeta({ ...META, healing: 50 }, t, statName)).toEqual([
      'move.meta.healing {"value":50}',
    ]);
  });
});

describe('describeZBoosts (RF03.4)', () => {
  it('lists the stat stages of a Z status move', () => {
    expect(describeZBoosts({ speed: 1 }, statName)).toBe('SPEED +1');
    expect(describeZBoosts({ attack: 1, defense: 1 }, statName)).toBe('ATTACK +1, DEFENSE +1');
    expect(describeZBoosts({}, statName)).toBeNull();
    expect(describeZBoosts(null, statName)).toBeNull();
  });
});

describe('learnersByTab (RF03.3)', () => {
  const learner = (pokemonId: number, methods: MoveLearner['methods']): MoveLearner => ({
    pokemonId,
    speciesId: pokemonId,
    name: `#${pokemonId}`,
    isDefault: true,
    types: [],
    inGame: true,
    methods,
  });

  it('splits learners per method, sorting level-up by level', () => {
    const tabs = learnersByTab([
      learner(1, [
        { tab: 'level-up', method: 'level-up', level: 30 },
        { tab: 'level-up', method: 'level-up', level: 12 },
        { tab: 'machine', method: 'machine', level: 0 },
      ]),
      learner(2, [{ tab: 'level-up', method: 'level-up', level: 5 }]),
      learner(3, [{ tab: 'egg', method: 'egg', level: 0 }]),
    ]);
    expect(tabs.map(([tab, entries]) => [tab, entries.map((e) => e.learner.pokemonId)])).toEqual([
      ['level-up', [2, 1]],
      ['machine', [1]],
      ['egg', [3]],
    ]);
    expect(tabs[0]?.[1][1]?.levels).toEqual([12, 30]);
    expect(tabs[1]?.[1][0]?.levels).toEqual([]);
    expect(learnersByTab([])).toEqual([]);
  });
});
