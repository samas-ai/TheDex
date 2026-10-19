import { describe, expect, it } from 'vitest';
import type { PokemonStats } from '@thedex/db';
import {
  baseOf,
  engineStat,
  finalStats,
  formatIvRange,
  gameIvs,
  ivCandidates,
  natureEffect,
  statsOf,
} from './stat-calc';

const GARCHOMP: PokemonStats = {
  hp: 108,
  attack: 130,
  defense: 95,
  specialAttack: 80,
  specialDefense: 85,
  speed: 102,
  special: null,
  bst: 600,
};
const MEWTWO_RBY: PokemonStats = {
  hp: 106,
  attack: 110,
  defense: 90,
  specialAttack: 154,
  specialDefense: 154,
  speed: 130,
  special: 154,
  bst: 644,
};
const all = (value: number) => ({
  hp: value,
  atk: value,
  def: value,
  spa: value,
  spd: value,
  spe: value,
});

describe('stat keys per generation', () => {
  it('shows a single Special in Gen 1', () => {
    expect(statsOf(1)).toEqual(['hp', 'atk', 'def', 'spa', 'spe']);
    expect(statsOf(2)).toHaveLength(6);
    expect(engineStat('spa', 1)).toBe('special');
    expect(engineStat('spa', 2)).toBe('special-attack');
    expect(engineStat('spd', 9)).toBe('special-defense');
  });

  it('reads base stats by key', () => {
    expect(
      ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map((s) => baseOf(GARCHOMP, s as never, 9)),
    ).toEqual([108, 130, 95, 80, 85, 102]);
    expect(baseOf(MEWTWO_RBY, 'spa', 1)).toBe(154);
    expect(baseOf({ ...MEWTWO_RBY, special: null, specialAttack: 150 }, 'spa', 1)).toBe(150);
  });

  it('applies natures from Gen 3, never to HP', () => {
    expect(natureEffect('adamant', 'atk', 9)).toBe(1.1);
    expect(natureEffect('adamant', 'spa', 9)).toBe(0.9);
    expect(natureEffect('adamant', 'hp', 9)).toBe(1);
    expect(natureEffect(null, 'atk', 9)).toBe(1);
    expect(natureEffect('adamant', 'atk', 2)).toBe(1);
  });
});

describe('gameIvs', () => {
  it('keeps IVs from Gen 3 on', () => {
    expect(gameIvs(all(31), 9)).toEqual(all(31));
  });

  it('turns Showdown IVs into DVs with the HP DV derived', () => {
    expect(gameIvs(all(31), 1)).toEqual(all(15));
    // Attack DV 14 (even) clears the HP DV's 8 bit; Sp. Def follows Special.
    expect(gameIvs({ ...all(31), atk: 28, spd: 0 }, 2)).toEqual({ ...all(15), hp: 7, atk: 14 });
  });
});

describe('finalStats', () => {
  it('matches Bulbapedia’s Lv. 78 Adamant Garchomp', () => {
    expect(
      finalStats(
        GARCHOMP,
        {
          level: 78,
          nature: 'adamant',
          ivs: { hp: 24, atk: 12, def: 30, spa: 16, spd: 23, spe: 5 },
          evs: { hp: 74, atk: 190, def: 91, spa: 48, spd: 84, spe: 23 },
        },
        9,
      ),
    ).toEqual({ hp: 289, atk: 278, def: 193, spa: 135, spd: 171, spe: 171 });
  });

  it('uses DVs and Stat Exp (EV²) in Gen 1', () => {
    expect(
      finalStats(MEWTWO_RBY, { level: 100, nature: null, ivs: all(15), evs: all(252) }, 1),
    ).toEqual({
      hp: 415,
      atk: 318,
      def: 278,
      spa: 406,
      spe: 358,
    });
  });
});

describe('out-of-range values', () => {
  it('counts EVs and IVs over the generation caps as the caps', () => {
    const spread = { level: 100, nature: null, ivs: all(31), evs: all(255) };
    expect(finalStats(GARCHOMP, spread, 9)).toEqual(
      finalStats(GARCHOMP, { ...spread, evs: all(252) }, 9),
    );
    expect(finalStats(MEWTWO_RBY, spread, 1)).toEqual(
      finalStats(MEWTWO_RBY, { ...spread, ivs: all(15) }, 1),
    );
  });
});

describe('reverse calculation', () => {
  it('lists the IVs that fit an observed stat', () => {
    const atk = { gen: 9, stat: 'atk', base: 130, level: 78, ev: 190, nature: 'adamant' } as const;
    expect(ivCandidates({ ...atk, value: 278 })).toEqual([11, 12]);
    expect(ivCandidates({ ...atk, value: 999 })).toEqual([]);
    expect(
      ivCandidates({
        gen: 1,
        stat: 'hp',
        base: 106,
        level: 100,
        ev: 252,
        nature: null,
        value: 415,
      }),
    ).toEqual([15]);
  });

  it('formats candidate ranges', () => {
    expect(formatIvRange([11, 12])).toBe('11–12');
    expect(formatIvRange([24])).toBe('24');
    expect(formatIvRange([])).toBeNull();
  });
});
