import { describe, expect, it } from 'vitest';
import type { Generation } from '../generations';
import {
  catchChance,
  criticalCaptureMultiplier,
  cumulativeCatchChance,
  type CatchInput,
} from './catch-rate';

// Reference values: the pret decompilations' formulas (Gen 1–4) and the 4096 fixed-point
// pipeline documented by Bulbapedia / Dragonfly Cave (Gen 5–9), computed step by step.

const base = (gen: Generation, overrides: Partial<CatchInput> = {}): CatchInput => ({
  gen,
  catchRate: 45,
  maxHp: 100,
  currentHp: 100,
  level: 30,
  status: 'none',
  ball: 'poke-ball',
  ...overrides,
});
const p = (input: CatchInput) => catchChance(input).probability;
/** Catch rate after the ball, through a full-HP Gen 2 throw (a = ⌊C' / 3⌋ at M = H = 85). */
const gen2Rate = (overrides: Partial<CatchInput>) =>
  catchChance(base(2, { maxHp: 85, currentHp: 85, ...overrides })).catchValue;

describe('validation and shared helpers', () => {
  it('rejects impossible inputs', () => {
    expect(() => catchChance(base(9, { catchRate: 0 }))).toThrow(/Catch rate/);
    expect(() => catchChance(base(9, { currentHp: 0 }))).toThrow(/Current HP/);
    expect(() => catchChance(base(9, { currentHp: 101 }))).toThrow(/Current HP/);
    expect(() => catchChance(base(9, { maxHp: 0 }))).toThrow(/Max HP/);
    expect(() => catchChance(base(9, { level: 0 }))).toThrow(/Level/);
    expect(() => catchChance(base(9, { conditions: { turn: -1 } }))).toThrow(/Turn/);
    expect(() => catchChance(base(9, { conditions: { playerLevel: 101 } }))).toThrow(/Your level/);
    expect(() => catchChance(base(9, { conditions: { speciesCaught: 1.5 } }))).toThrow(/Species/);
    expect(() => catchChance(base(6, { conditions: { captureBonus: 50 } }))).toThrow(/bonus/);
    expect(() => catchChance(base(9, { conditions: { badges: 9 } }))).toThrow(/Badges/);
  });

  it('always catches with the Master Ball and the Pal Park Park Ball', () => {
    for (const gen of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
      expect(catchChance(base(gen, { catchRate: 3, ball: 'master-ball' }))).toMatchObject({
        probability: 1,
        guaranteed: true,
      });
    }
    expect(p(base(4, { catchRate: 3, ball: 'park-ball' }))).toBe(1);
  });

  it('accumulates throws and scales critical captures by species caught', () => {
    expect(cumulativeCatchChance(0.5, 3)).toBe(0.875);
    expect(cumulativeCatchChance(0, 10)).toBe(0);
    expect(
      [0, 30, 31, 150, 151, 300, 301, 450, 451, 600, 601].map(criticalCaptureMultiplier),
    ).toEqual([0, 0, 2048, 2048, 4096, 4096, 6144, 6144, 8192, 8192, 10240]);
  });
});

describe('Gen 1', () => {
  it('matches the closed form of the R1 / F checks', () => {
    // ⌊25500/12⌋ = 2125, ⌊100/4⌋ = 25 → F = 85: 46 × 86 / 65536.
    expect(p(base(1))).toBeCloseTo(989 / 16384, 12);
    // F saturates; asleep: 25/151 + 4/151.
    expect(
      p(base(1, { catchRate: 3, maxHp: 200, currentHp: 1, ball: 'ultra-ball', status: 'sleep' })),
    ).toBeCloseTo(29 / 151, 12);
    // The Great Ball's smaller divisor beats the Ultra Ball at full HP.
    const full = { catchRate: 255, maxHp: 30, currentHp: 30 };
    expect(p(base(1, { ...full, ball: 'great-ball' }))).toBeCloseTo(137 / 256, 12);
    expect(p(base(1, { ...full, ball: 'ultra-ball' }))).toBeCloseTo(23 / 64, 12);
    expect(p(base(1, { ...full, ball: 'safari-ball' }))).toBeCloseTo(23 / 64, 12);
    expect(p(base(1, { currentHp: 50, ball: 'great-ball', status: 'paralysis' }))).toBeCloseTo(
      58 / 201,
      12,
    );
  });

  it('reports a sure catch and no catch value', () => {
    expect(
      catchChance(base(1, { catchRate: 255, maxHp: 100, currentHp: 1, ball: 'ultra-ball' })),
    ).toEqual({
      probability: 1,
      criticalChance: 0,
      shakeProbability: null,
      guaranteed: true,
      catchValue: null,
      clamped: false,
    });
  });
});

describe('Gen 2', () => {
  it('computes a with the 8-bit HP term and the status bug', () => {
    const ultra = base(2, { ball: 'ultra-ball' });
    expect(catchChance(ultra)).toMatchObject({ catchValue: 30, probability: 31 / 256 });
    expect(p({ ...ultra, status: 'sleep' })).toBe(41 / 256);
    expect(p({ ...ultra, status: 'freeze' })).toBe(41 / 256);
    expect(p({ ...ultra, status: 'paralysis' })).toBe(31 / 256);
    expect(p(base(2, { catchRate: 3, maxHp: 50, currentHp: 1, status: 'sleep' }))).toBe(13 / 256);
    // 3M > 255: both HP values are divided by 4, and a 0 becomes 1.
    expect(
      p(base(2, { catchRate: 3, maxHp: 150, currentHp: 1, ball: 'ultra-ball', status: 'sleep' })),
    ).toBe(16 / 256);
    // x never drops below 1.
    expect(gen2Rate({ catchRate: 1 })).toBe(1);
    expect(catchChance(base(2, { catchRate: 255, currentHp: 1 }))).toMatchObject({
      guaranteed: false,
      catchValue: 251,
    });
    expect(catchChance(base(2, { catchRate: 255, currentHp: 1, status: 'sleep' }))).toMatchObject({
      guaranteed: true,
      probability: 1,
    });
  });

  it('freezes on the max HP values that divide by zero', () => {
    expect(() => catchChance(base(2, { maxHp: 342, currentHp: 342 }))).toThrow(/freezes/);
  });

  it('applies the GSC balls to the catch rate, bugs included', () => {
    expect(gen2Rate({ catchRate: 90, ball: 'great-ball' })).toBe(45);
    expect(gen2Rate({ catchRate: 90, ball: 'park-ball' })).toBe(45);
    expect(gen2Rate({ catchRate: 90, ball: 'sport-ball' })).toBe(45);
    expect(gen2Rate({ catchRate: 200, ball: 'ultra-ball' })).toBe(85);
    expect(gen2Rate({ catchRate: 30, ball: 'fast-ball', target: { speciesId: 81 } })).toBe(40);
    expect(gen2Rate({ catchRate: 30, ball: 'fast-ball', target: { speciesId: 25 } })).toBe(10);
    expect(gen2Rate({ catchRate: 30, ball: 'fast-ball' })).toBe(10);
    expect(gen2Rate({ catchRate: 30, ball: 'lure-ball', conditions: { fishing: true } })).toBe(30);
    expect(gen2Rate({ catchRate: 30, ball: 'lure-ball' })).toBe(10);
    expect(
      gen2Rate({ catchRate: 30, ball: 'love-ball', conditions: { loveMatch: 'same-gender' } }),
    ).toBe(80);
    expect(
      gen2Rate({ catchRate: 30, ball: 'love-ball', conditions: { loveMatch: 'opposite-gender' } }),
    ).toBe(10);
    expect(gen2Rate({ catchRate: 30, ball: 'moon-ball', target: { speciesId: 35 } })).toBe(10);
    expect(gen2Rate({ catchRate: 30, ball: 'friend-ball' })).toBe(10);
  });

  it('weighs the Heavy Ball in tiers, never below 1', () => {
    const heavy = (weightHg: number | undefined, catchRate = 60) =>
      gen2Rate({ catchRate, ball: 'heavy-ball', target: { weightHg } });
    expect([1000, 1500, 2500, 3500, 5000].map((w) => heavy(w))).toEqual([13, 20, 26, 30, 33]);
    expect(heavy(100, 3)).toBe(1);
    expect(heavy(undefined)).toBe(13);
  });

  it('skips the HP term and status for the Level Ball (a bug)', () => {
    const level = (playerLevel: number | undefined, wild = 9) =>
      catchChance(
        base(2, { level: wild, ball: 'level-ball', status: 'sleep', conditions: { playerLevel } }),
      ).catchValue;
    expect(level(40)).toBe(255);
    expect(level(30)).toBe(180);
    expect(level(15)).toBe(90);
    expect(level(9)).toBe(45);
    expect(level(undefined)).toBe(45);
    expect(p(base(2, { level: 9, ball: 'level-ball', conditions: { playerLevel: 40 } }))).toBe(1);
  });
});

describe('Gen 3–4', () => {
  it('computes a and b like the decompilations', () => {
    expect(catchChance(base(3, { currentHp: 1, ball: 'ultra-ball' }))).toMatchObject({
      catchValue: 89,
      shakeProbability: 52428 / 65536,
    });
    expect(p(base(3, { currentHp: 1, ball: 'ultra-ball' }))).toBeCloseTo(0.409575, 6);
    expect(p(base(3, { catchRate: 3, maxHp: 200, currentHp: 200 }))).toBeCloseTo(0.004159, 6);
    expect(p(base(4, { currentHp: 50, ball: 'great-ball', status: 'paralysis' }))).toBeCloseTo(
      0.279726,
      6,
    );
    expect(p(base(4, { ball: 'quick-ball' }))).toBeCloseTo(0.279726, 6);
    expect(
      p(
        base(4, {
          catchRate: 3,
          maxHp: 150,
          currentHp: 1,
          status: 'sleep',
          ball: 'timer-ball',
          conditions: { turn: 30 },
        }),
      ),
    ).toBeCloseTo(0.092651, 6);
    expect(catchChance(base(3, { status: 'freeze' })).catchValue).toBe(30);
  });

  it('guarantees a ≥ 255', () => {
    expect(
      catchChance(base(3, { catchRate: 255, currentHp: 1, ball: 'ultra-ball' })),
    ).toMatchObject({ guaranteed: true, probability: 1, catchValue: 506 });
  });

  const value = (gen: 3 | 4, overrides: Partial<CatchInput>) =>
    catchChance(base(gen, { catchRate: 100, maxHp: 1, currentHp: 1, ...overrides })).catchValue;

  it('applies the RSE/DPPt ball multipliers', () => {
    expect(value(3, {})).toBe(33);
    expect(value(3, { ball: 'great-ball' })).toBe(50);
    expect(value(3, { ball: 'safari-ball' })).toBe(50);
    expect(value(3, { ball: 'net-ball', target: { types: ['water'] } })).toBe(100);
    expect(value(3, { ball: 'net-ball', target: { types: ['bug', 'flying'] } })).toBe(100);
    expect(value(3, { ball: 'net-ball' })).toBe(33);
    expect(value(3, { ball: 'dive-ball', conditions: { underwater: true } })).toBe(116);
    expect(value(3, { ball: 'dive-ball', conditions: { surfing: true } })).toBe(33);
    expect(value(4, { ball: 'dive-ball', conditions: { fishing: true } })).toBe(116);
    expect(value(4, { ball: 'dive-ball', conditions: { surfing: true } })).toBe(116);
    expect(value(3, { ball: 'nest-ball', level: 5 })).toBe(116);
    expect(value(3, { ball: 'nest-ball', level: 35 })).toBe(33);
    expect(value(3, { ball: 'nest-ball', level: 50 })).toBe(33);
    expect(value(3, { ball: 'repeat-ball', conditions: { alreadyCaught: true } })).toBe(100);
    expect(value(3, { ball: 'repeat-ball' })).toBe(33);
    expect(value(3, { ball: 'timer-ball' })).toBe(33);
    expect(value(3, { ball: 'timer-ball', conditions: { turn: 10 } })).toBe(66);
    expect(value(3, { ball: 'timer-ball', conditions: { turn: 99 } })).toBe(133);
    // Gen 4 balls do not exist in Gen 3.
    expect(value(3, { ball: 'quick-ball' })).toBe(33);
    expect(value(4, { ball: 'quick-ball', conditions: { turn: 1 } })).toBe(33);
    expect(value(4, { ball: 'sport-ball' })).toBe(50);
    expect(value(4, { ball: 'dusk-ball', conditions: { night: true } })).toBe(116);
    expect(value(4, { ball: 'dusk-ball', conditions: { cave: true } })).toBe(116);
    expect(value(4, { ball: 'dusk-ball' })).toBe(33);
    expect(value(4, { ball: 'heal-ball' })).toBe(33);
  });

  it('changes the catch rate with the HGSS Apricorn Balls', () => {
    // ×4, ×8, ×3… saturate at a catch rate of 255 (a = ⌊255 / 3⌋ = 85 here).
    expect(value(4, { ball: 'fast-ball', target: { baseSpeed: 100 } })).toBe(85);
    expect(value(4, { ball: 'fast-ball', target: { baseSpeed: 99 } })).toBe(33);
    expect(value(4, { ball: 'fast-ball' })).toBe(33);
    expect(value(4, { ball: 'level-ball', level: 10, conditions: { playerLevel: 50 } })).toBe(85);
    expect(value(4, { ball: 'lure-ball', conditions: { fishing: true } })).toBe(85);
    expect(value(4, { ball: 'lure-ball' })).toBe(33);
    expect(value(4, { ball: 'love-ball', conditions: { loveMatch: 'opposite-gender' } })).toBe(85);
    expect(value(4, { ball: 'love-ball' })).toBe(33);
    expect(value(4, { ball: 'moon-ball', target: { speciesId: 35 } })).toBe(85);
    expect(value(4, { catchRate: 30, ball: 'moon-ball', target: { speciesId: 35 } })).toBe(40);
    expect(value(4, { ball: 'moon-ball' })).toBe(33);
    expect(value(4, { ball: 'heavy-ball', target: { weightHg: 5000 } })).toBe(46);
    expect(value(4, { ball: 'heavy-ball', target: { weightHg: 3500 } })).toBe(43);
    expect(value(4, { ball: 'heavy-ball', target: { weightHg: 2500 } })).toBe(40);
    expect(value(4, { ball: 'heavy-ball', target: { weightHg: 1500 } })).toBe(26);
    expect(value(4, { ball: 'heavy-ball' })).toBe(26);
    // Apricorn Balls do not exist in Gen 3.
    expect(value(3, { ball: 'fast-ball', target: { baseSpeed: 150 } })).toBe(33);
  });

  it('raises a zero catch value to 1 (the HGSS Heavy Ball on light legendaries)', () => {
    const light = base(4, { catchRate: 3, ball: 'heavy-ball', target: { weightHg: 100 } });
    expect(catchChance(light)).toMatchObject({ catchValue: 1, clamped: true });
    // Below 0 the game sets 1, exactly 0 stays 0.
    expect(catchChance({ ...light, catchRate: 20, maxHp: 1, currentHp: 1 }).clamped).toBe(true);
    expect(catchChance({ ...light, catchRate: 25, maxHp: 1, currentHp: 1 }).catchValue).toBe(1);
  });
});

describe('Gen 5–9 fixed point', () => {
  it('matches Gen 5 references (three shake checks, Pass Power, dark grass)', () => {
    const ultra = base(5, {
      currentHp: 1,
      ball: 'ultra-ball',
      conditions: { speciesCaught: 200 },
    });
    expect(catchChance(ultra)).toMatchObject({
      shakeProbability: 50429 / 65536,
      criticalChance: 14 / 256,
    });
    expect(catchChance(ultra).catchValue).toBeCloseTo(366182 / 4096, 10);
    expect(p(ultra)).toBeCloseTo(0.472783, 6);
    expect(
      p(
        base(5, {
          catchRate: 3,
          maxHp: 150,
          currentHp: 1,
          status: 'sleep',
          ball: 'timer-ball',
          conditions: { turn: 5, speciesCaught: 500 },
        }),
      ),
    ).toBeCloseTo(0.149653, 6);
    expect(
      p(
        base(5, {
          catchRate: 255,
          maxHp: 20,
          currentHp: 20,
          level: 5,
          ball: 'nest-ball',
          conditions: { darkGrass: true, speciesCaught: 30 },
        }),
      ),
    ).toBeCloseTo(0.464731, 6);
    expect(
      p(
        base(5, {
          ball: 'great-ball',
          status: 'paralysis',
          conditions: { captureBonus: 130, speciesCaught: 650 },
        }),
      ),
    ).toBeCloseTo(0.293607, 6);
  });

  it('matches Gen 6–7 references (O-Power, Ultra Beasts, Heavy Ball)', () => {
    expect(
      p(base(6, { currentHp: 1, ball: 'ultra-ball', conditions: { speciesCaught: 200 } })),
    ).toBeCloseTo(0.475431, 6);
    expect(
      p(
        base(6, {
          catchRate: 3,
          maxHp: 200,
          currentHp: 1,
          status: 'paralysis',
          ball: 'dusk-ball',
          conditions: { night: true, captureBonus: 250, speciesCaught: 650 },
        }),
      ),
    ).toBeCloseTo(0.274297, 6);
    const buzzwole = base(7, {
      maxHp: 200,
      currentHp: 1,
      ball: 'ultra-ball',
      target: { speciesId: 794 },
      conditions: { speciesCaught: 200 },
    });
    expect(p(buzzwole)).toBeCloseTo(0.048324, 6);
    expect(p({ ...buzzwole, ball: 'beast-ball' })).toBeCloseTo(0.917867, 6);
    expect(
      p(
        base(7, {
          catchRate: 3,
          maxHp: 60,
          currentHp: 1,
          ball: 'heavy-ball',
          target: { weightHg: 950 },
        }),
      ),
    ).toBeCloseTo(0.015538, 6);
    expect(
      p(
        base(7, {
          status: 'sleep',
          ball: 'net-ball',
          target: { types: ['water'] },
          conditions: { speciesCaught: 200 },
        }),
      ),
    ).toBeCloseTo(0.63031, 6);
  });

  it('matches Gen 8 references (low level, under-level penalty, Catching Charm)', () => {
    expect(
      p(
        base(8, {
          catchRate: 255,
          maxHp: 20,
          currentHp: 20,
          level: 5,
          conditions: { speciesCaught: 100, catchingCharm: true },
        }),
      ),
    ).toBeCloseTo(0.885397, 6);
    expect(
      p(
        base(8, {
          level: 35,
          currentHp: 50,
          ball: 'ultra-ball',
          conditions: { underLevelPenalty: true, speciesCaught: 200 },
        }),
      ),
    ).toBeCloseTo(0.061816, 6);
    expect(
      p(
        base(8, {
          catchRate: 3,
          maxHp: 300,
          currentHp: 1,
          level: 70,
          status: 'sleep',
          ball: 'timer-ball',
          conditions: { turn: 10, speciesCaught: 500, catchingCharm: true },
        }),
      ),
    ).toBeCloseTo(0.235284, 6);
  });

  it('matches Gen 9 references (badges, Catching Power, off guard)', () => {
    expect(
      p(
        base(9, {
          catchRate: 255,
          maxHp: 20,
          currentHp: 20,
          level: 5,
          conditions: { badges: 0 },
        }),
      ),
    ).toBeCloseTo(0.898517, 6);
    expect(
      p(
        base(9, {
          maxHp: 150,
          currentHp: 75,
          level: 46,
          status: 'paralysis',
          ball: 'ultra-ball',
          conditions: { badges: 2, catchingPower: 2, offGuard: true, speciesCaught: 200 },
        }),
      ),
    ).toBeCloseTo(0.574105, 6);
    const lategame = base(9, {
      catchRate: 3,
      maxHp: 300,
      currentHp: 1,
      level: 70,
      status: 'sleep',
      ball: 'ultra-ball',
      conditions: { badges: 8, speciesCaught: 700, catchingCharm: true },
    });
    expect(p(lategame)).toBeCloseTo(0.141208, 6);
    expect(p({ ...lategame, conditions: { badges: 8, speciesCaught: 700 } })).toBeCloseTo(
      0.13023,
      6,
    );
    // Catching Power 1 (×1.1) and the default of 8 badges (no penalty).
    expect(catchChance(base(9, { conditions: { catchingPower: 1 } })).catchValue).toBeGreaterThan(
      catchChance(base(9)).catchValue!,
    );
  });

  it('guarantees X ≥ 255 and gives Gen 5 Dream Balls a sure catch', () => {
    expect(
      catchChance(base(7, { catchRate: 255, currentHp: 1, ball: 'ultra-ball' })),
    ).toMatchObject({ guaranteed: true, probability: 1 });
    expect(p(base(5, { catchRate: 3, ball: 'dream-ball' }))).toBe(1);
  });

  /** X / 4096 (catch value) at M = H = 1, catch rate 100: ⌊100 × ball / 3⌋-ish. */
  const value = (gen: Generation, overrides: Partial<CatchInput>) =>
    (catchChance(base(gen, { catchRate: 30, maxHp: 1, currentHp: 1, level: 50, ...overrides }))
      .catchValue! *
      3) /
    30;

  it('applies the Gen 5+ ball multipliers', () => {
    const near = (gen: Generation, overrides: Partial<CatchInput>, expected: number) =>
      expect(value(gen, overrides)).toBeCloseTo(expected, 2);
    near(5, {}, 1);
    near(5, { ball: 'great-ball' }, 1.5);
    near(9, { ball: 'ultra-ball' }, 2);
    near(5, { ball: 'safari-ball' }, 1.5);
    near(8, { ball: 'sport-ball' }, 1);
    near(6, { ball: 'net-ball', target: { types: ['bug'] } }, 3);
    near(7, { ball: 'net-ball', target: { types: ['water'] } }, 3.5);
    near(7, { ball: 'net-ball' }, 1);
    near(5, { ball: 'dive-ball', conditions: { surfing: true } }, 3.5);
    near(9, { ball: 'dive-ball', conditions: { underwater: true } }, 3.5);
    near(9, { ball: 'dive-ball' }, 1);
    near(5, { ball: 'nest-ball', level: 30 }, 1.1);
    near(5, { ball: 'nest-ball', level: 50 }, 1);
    near(6, { ball: 'nest-ball', level: 1 }, 4);
    near(6, { ball: 'nest-ball', level: 30 }, 1);
    near(6, { ball: 'repeat-ball', conditions: { alreadyCaught: true } }, 3);
    near(8, { ball: 'repeat-ball', conditions: { alreadyCaught: true } }, 3.5);
    near(8, { ball: 'repeat-ball' }, 1);
    near(5, { ball: 'timer-ball', conditions: { turn: 3 } }, 1.9);
    near(5, { ball: 'timer-ball', conditions: { turn: 30 } }, 4);
    near(5, { ball: 'timer-ball' }, 1);
    near(6, { ball: 'dusk-ball', conditions: { cave: true } }, 3.5);
    near(9, { ball: 'dusk-ball', conditions: { night: true } }, 3);
    near(9, { ball: 'dusk-ball' }, 1);
    near(9, { ball: 'quick-ball' }, 5);
    near(9, { ball: 'quick-ball', conditions: { turn: 1 } }, 1);
    near(8, { ball: 'dream-ball', status: 'sleep' }, 4 * 2.5);
    near(7, { ball: 'dream-ball', status: 'sleep' }, 2.5);
    near(8, { ball: 'dream-ball' }, 1);
    near(7, { ball: 'beast-ball' }, 0.1);
    near(7, { ball: 'fast-ball', target: { baseSpeed: 120 } }, 4);
    near(7, { ball: 'fast-ball' }, 1);
    near(7, { ball: 'level-ball', level: 10, conditions: { playerLevel: 40 } }, 8);
    near(7, { ball: 'level-ball', level: 20, conditions: { playerLevel: 40 } }, 4);
    near(7, { ball: 'level-ball', level: 30, conditions: { playerLevel: 40 } }, 2);
    near(7, { ball: 'level-ball', level: 40, conditions: { playerLevel: 40 } }, 1);
    near(7, { ball: 'level-ball' }, 1);
    near(6, { ball: 'lure-ball', conditions: { fishing: true } }, 3);
    near(7, { ball: 'lure-ball', conditions: { fishing: true } }, 5);
    near(8, { ball: 'lure-ball', conditions: { fishing: true } }, 4);
    near(8, { ball: 'lure-ball', conditions: { surfing: true } }, 1);
    near(9, { ball: 'lure-ball', conditions: { surfing: true } }, 4);
    near(9, { ball: 'lure-ball' }, 1);
    near(7, { ball: 'love-ball', conditions: { loveMatch: 'opposite-gender' } }, 8);
    near(7, { ball: 'love-ball', conditions: { loveMatch: 'same-gender' } }, 1);
    near(7, { ball: 'moon-ball', target: { speciesId: 517 } }, 4);
    near(7, { ball: 'moon-ball' }, 1);
    near(7, { ball: 'premier-ball' }, 1);
  });

  it('adds the Gen 7+ Heavy Ball tiers to the catch rate', () => {
    const heavy = (weightHg?: number) =>
      value(8, { ball: 'heavy-ball', target: weightHg === undefined ? {} : { weightHg } }) * 30;
    expect([3500, 2500, 1500, 500].map(heavy).map(Math.round)).toEqual([60, 50, 30, 10]);
    expect(Math.round(heavy())).toBe(10);
  });

  it('only boosts the Beast Ball against Ultra Beasts from Gen 7', () => {
    const ub = { target: { speciesId: 799 } };
    expect(value(7, { ...ub, ball: 'beast-ball' })).toBeCloseTo(5, 2);
    expect(value(8, { ...ub, ball: 'master-ball' })).toBe(25.5);
    expect(value(8, { ...ub, ball: 'quick-ball' })).toBeCloseTo(0.1, 2);
    expect(value(6, { ...ub, ball: 'quick-ball' })).toBeCloseTo(5, 2);
  });

  it('scales Gen 5 dark grass by species caught', () => {
    const grass = (speciesCaught: number) =>
      value(5, { conditions: { darkGrass: true, speciesCaught } });
    expect([601, 451, 301, 151, 31, 30].map((n) => Math.round(grass(n) * 10) / 10)).toEqual([
      1, 0.9, 0.8, 0.7, 0.5, 0.3,
    ]);
    expect(value(6, { conditions: { darkGrass: true } })).toBeCloseTo(1, 2);
  });

  it('applies the Gen 8–9 low-level bonuses', () => {
    expect(value(8, { level: 20 })).toBeCloseTo(1, 2);
    expect(value(8, { level: 10 })).toBeCloseTo(2, 2);
    expect(value(9, { level: 12 })).toBeCloseTo(1.2, 2);
    expect(value(9, { level: 13 })).toBeCloseTo(1, 2);
  });
});
