import { describe, expect, it } from 'vitest';
import { calcStat, evLimits, hpDv, maxIv, statBounds, statExpBonus } from './stats';

describe('Gen 1–2 stats (DV + Stat Experience)', () => {
  // Reference: max Lv. 100 Mewtwo in RBY is the famous 415/318/278/406/358 spread.
  it('matches the max Lv. 100 Mewtwo in Red/Blue', () => {
    const max = (stat: 'hp' | 'attack' | 'defense' | 'special' | 'speed', base: number) =>
      calcStat({ gen: 1, stat, base, level: 100, iv: 15, ev: 65535 });
    expect([
      max('hp', 106),
      max('attack', 110),
      max('defense', 90),
      max('special', 154),
      max('speed', 130),
    ]).toEqual([415, 318, 278, 406, 358]);
  });

  it('computes the minimum and other levels', () => {
    expect(calcStat({ gen: 1, stat: 'hp', base: 106, level: 100, iv: 0, ev: 0 })).toBe(322);
    expect(calcStat({ gen: 1, stat: 'attack', base: 110, level: 100, iv: 0, ev: 0 })).toBe(225);
    expect(calcStat({ gen: 1, stat: 'hp', base: 106, level: 50, iv: 15, ev: 65535 })).toBe(212);
    // GSC Tyranitar, max Attack.
    expect(calcStat({ gen: 2, stat: 'attack', base: 134, level: 100, iv: 15, ev: 65535 })).toBe(
      366,
    );
  });

  it('caps the Stat Experience root at 255 like the games', () => {
    expect(statExpBonus(0)).toBe(0);
    expect(statExpBonus(1)).toBe(0);
    expect(statExpBonus(16)).toBe(1);
    expect(statExpBonus(17)).toBe(1);
    expect(statExpBonus(62001)).toBe(62); // 249²
    expect(statExpBonus(63504)).toBe(63); // 252²
    expect(statExpBonus(65535)).toBe(63); // ⌈√⌉ = 256, capped to 255
    expect(() => statExpBonus(65536)).toThrow(RangeError);
  });

  it('derives the HP DV from the other DVs', () => {
    expect(hpDv({ attack: 15, defense: 14, speed: 13, special: 12 })).toBe(10);
    expect(hpDv({ attack: 15, defense: 15, speed: 15, special: 15 })).toBe(15);
    expect(() => hpDv({ attack: 16, defense: 0, speed: 0, special: 0 })).toThrow(RangeError);
  });
});

describe('Gen 3+ stats (IV + EV + nature)', () => {
  // Reference: Garchomp (108/130) — 420 HP and 394 Atk max at Lv. 100, 200 Atk at Lv. 50.
  it('matches Garchomp references at Lv. 100 and Lv. 50', () => {
    const atk = (level: number, iv: number, ev: number, nature: 0.9 | 1 | 1.1) =>
      calcStat({ gen: 9, stat: 'attack', base: 130, level, iv, ev, nature });
    expect(atk(100, 31, 252, 1.1)).toBe(394);
    expect(atk(100, 31, 252, 1)).toBe(359);
    expect(atk(100, 0, 0, 0.9)).toBe(238);
    expect(atk(50, 31, 252, 1.1)).toBe(200);
    expect(calcStat({ gen: 4, stat: 'hp', base: 108, level: 100, iv: 31, ev: 252 })).toBe(420);
    expect(calcStat({ gen: 4, stat: 'hp', base: 108, level: 50, iv: 31, ev: 252 })).toBe(215);
    expect(calcStat({ gen: 9, stat: 'hp', base: 108, level: 100, iv: 0, ev: 0 })).toBe(326);
  });

  it('floors the nature multiplier with integer arithmetic', () => {
    // (⌊(200 + 31 + 63) × 100 / 100⌋ + 5) = 299 → 328.9 → 328 and 269.1 → 269.
    const stat = (nature: 0.9 | 1.1) =>
      calcStat({ gen: 8, stat: 'speed', base: 100, level: 100, iv: 31, ev: 252, nature });
    expect(stat(1.1)).toBe(328);
    expect(stat(0.9)).toBe(269);
  });

  it('defaults to a neutral nature', () => {
    expect(calcStat({ gen: 9, stat: 'speed', base: 100, level: 100, iv: 31, ev: 252 })).toBe(299);
  });

  it('gives Shedinja exactly 1 HP and Blissey 714 max HP', () => {
    expect(calcStat({ gen: 3, stat: 'hp', base: 1, level: 100, iv: 31, ev: 252 })).toBe(1);
    expect(calcStat({ gen: 9, stat: 'hp', base: 1, level: 1, iv: 0, ev: 0 })).toBe(1);
    expect(calcStat({ gen: 9, stat: 'hp', base: 255, level: 100, iv: 31, ev: 252 })).toBe(714);
  });
});

describe('limits and validation', () => {
  it('reports IV and EV limits per generation', () => {
    expect(maxIv(2)).toBe(15);
    expect(maxIv(3)).toBe(31);
    expect(evLimits(1)).toEqual({ perStat: 65535, total: null });
    expect(evLimits(5)).toEqual({ perStat: 255, total: 510 });
    expect(evLimits(6)).toEqual({ perStat: 252, total: 510 });
    expect(calcStat({ gen: 5, stat: 'attack', base: 100, level: 100, iv: 31, ev: 255 })).toBe(299);
  });

  it('rejects stats that do not exist in the generation', () => {
    expect(() => calcStat({ gen: 2, stat: 'special', base: 100, level: 50, iv: 0, ev: 0 })).toThrow(
      /generation 1/,
    );
    expect(() =>
      calcStat({ gen: 1, stat: 'special-attack', base: 100, level: 50, iv: 0, ev: 0 }),
    ).toThrow(/use "special"/);
    expect(
      calcStat({ gen: 2, stat: 'special-defense', base: 100, level: 100, iv: 15, ev: 65535 }),
    ).toBe(298);
  });

  it('rejects out-of-range inputs', () => {
    const ok = { gen: 9, stat: 'attack', base: 100, level: 50, iv: 31, ev: 252 } as const;
    expect(() => calcStat({ ...ok, base: 0 })).toThrow(/Base stat/);
    expect(() => calcStat({ ...ok, level: 101 })).toThrow(/Level/);
    expect(() => calcStat({ ...ok, level: 1.5 })).toThrow(/Level/);
    expect(() => calcStat({ ...ok, iv: 32 })).toThrow(/IV/);
    expect(() => calcStat({ ...ok, ev: 253 })).toThrow(/EV/);
    expect(() => calcStat({ ...ok, gen: 2, iv: 16 })).toThrow(/DV/);
    expect(() => calcStat({ ...ok, gen: 2, iv: 15, ev: 65536 })).toThrow(/Stat Experience/);
  });

  it('rejects natures before Gen 3 and on HP', () => {
    expect(() =>
      calcStat({ gen: 2, stat: 'attack', base: 100, level: 50, iv: 0, ev: 0, nature: 1.1 }),
    ).toThrow(/generation 3/);
    expect(() =>
      calcStat({ gen: 9, stat: 'hp', base: 100, level: 50, iv: 0, ev: 0, nature: 0.9 }),
    ).toThrow(/HP/);
  });
});

describe('statBounds (RF02.4)', () => {
  it('spans hindering 0/0 to beneficial 31/252 in Gen 3+', () => {
    expect(statBounds({ gen: 9, stat: 'attack', base: 130, level: 100 })).toEqual({
      min: 238,
      minNeutral: 265,
      maxNeutral: 359,
      max: 394,
    });
  });

  it('ignores natures for HP and in Gen 1–2', () => {
    expect(statBounds({ gen: 9, stat: 'hp', base: 108, level: 50 })).toEqual({
      min: 168,
      minNeutral: 168,
      maxNeutral: 215,
      max: 215,
    });
    expect(statBounds({ gen: 1, stat: 'special', base: 154, level: 100 })).toEqual({
      min: 313,
      minNeutral: 313,
      maxNeutral: 406,
      max: 406,
    });
  });
});
