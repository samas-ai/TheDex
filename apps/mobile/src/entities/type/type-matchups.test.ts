import { describe, expect, it } from 'vitest';
import {
  defensiveGroups,
  multiplierLabel,
  offensiveGroups,
  toggleTypePair,
  typeChart,
} from './type-matchups';

describe('defensiveGroups (RF02.3, RF07.1)', () => {
  it('groups attacking types by multiplier, respecting the generation', () => {
    const gen9 = defensiveGroups(['fire', 'flying'], 9);
    expect(gen9[0]).toEqual({ multiplier: 4, types: ['rock'] });
    expect(gen9.find((g) => g.multiplier === 0)?.types).toEqual(['ground']);
    // Gen 1 has no Steel/Dark/Fairy attackers.
    const gen1 = defensiveGroups(['fire', 'flying'], 1);
    expect(gen1.flatMap((g) => g.types)).toHaveLength(15);
    expect(defensiveGroups(['stellar'], 9)).toEqual([]);
  });

  it('labels fractions', () => {
    expect(multiplierLabel(0.5)).toBe('×½');
    expect(multiplierLabel(0.25)).toBe('×¼');
    expect(multiplierLabel(4)).toBe('×4');
  });
});

describe('offensiveGroups (RF07.1)', () => {
  it('lists what a single type hits super effectively, resists or cannot touch', () => {
    const electric = offensiveGroups(['electric'], 9);
    expect(electric.map((g) => g.multiplier)).toEqual([2, 1, 0.5, 0]);
    expect(electric[0]?.types).toEqual(['flying', 'water']);
    expect(electric.find((g) => g.multiplier === 0)?.types).toEqual(['ground']);
  });

  it('keeps the best multiplier of two attacking types (STAB coverage)', () => {
    const coverage = offensiveGroups(['electric', 'ice'], 9);
    const superEffective = coverage.find((g) => g.multiplier === 2)?.types;
    expect(superEffective).toEqual(['flying', 'ground', 'water', 'grass', 'dragon']);
    // Ground is immune to Electric but weak to Ice.
    expect(coverage.find((g) => g.multiplier === 0)).toBeUndefined();
  });

  it('follows the generation chart (Ghost vs Psychic in Gen 1)', () => {
    expect(offensiveGroups(['ghost'], 1).find((g) => g.multiplier === 0)?.types).toEqual([
      'normal',
      'psychic',
    ]);
    expect(offensiveGroups([], 9)).toEqual([]);
  });
});

describe('typeChart (RF07.1)', () => {
  it('builds the generation chart with rows attacking and columns defending', () => {
    const gen9 = typeChart(9);
    expect(gen9.types).toHaveLength(18);
    const at = (attacking: string, defending: string) =>
      gen9.cells[gen9.types.indexOf(attacking as never)]![gen9.types.indexOf(defending as never)];
    expect(at('fire', 'grass')).toBe(2);
    expect(at('normal', 'ghost')).toBe(0);
    expect(at('dragon', 'fairy')).toBe(0);
    expect(typeChart(1).types).toHaveLength(15);
  });
});

describe('toggleTypePair', () => {
  it('keeps at most two types, replacing the oldest', () => {
    expect(toggleTypePair([], 'fire')).toEqual(['fire']);
    expect(toggleTypePair(['fire', 'water'], 'grass')).toEqual(['water', 'grass']);
    expect(toggleTypePair(['fire', 'water'], 'fire')).toEqual(['water']);
  });
});
