import { describe, expect, it } from 'vitest';
import {
  captureBonusOptions,
  expectedThrows,
  formatChance,
  hpFromPercent,
  relevantConditions,
  wildMaxHp,
} from './catch-logic';

describe('wild HP', () => {
  it('uses mid-range IVs and no EVs', () => {
    // Pikachu (35 HP) at Lv. 50: ⌊(70 + 15) × 50 / 100⌋ + 60 = 102.
    expect(wildMaxHp(35, 50, 9)).toBe(102);
    // Gen 1: ⌊(35 + 7) × 2 × 50 / 100⌋ + 60 = 102.
    expect(wildMaxHp(35, 50, 1)).toBe(102);
    expect(wildMaxHp(1, 50, 9)).toBe(1);
  });

  it('turns a percentage into HP, never 0', () => {
    expect(hpFromPercent(102, 100)).toBe(102);
    expect(hpFromPercent(102, 50)).toBe(51);
    expect(hpFromPercent(102, 1)).toBe(1);
    expect(hpFromPercent(30, 0)).toBe(1);
  });
});

describe('conditions per ball and generation', () => {
  const keys = (ball: string, gen: Parameters<typeof relevantConditions>[1]) =>
    [...relevantConditions(ball, gen)].sort();

  it('asks only what the ball and the generation use', () => {
    expect(keys('poke-ball', 3)).toEqual([]);
    expect(keys('quick-ball', 4)).toEqual(['turn']);
    expect(keys('timer-ball', 3)).toEqual(['turn']);
    expect(keys('dusk-ball', 4)).toEqual(['cave', 'night']);
    expect(keys('dive-ball', 3)).toEqual(['underwater']);
    expect(keys('dive-ball', 4)).toEqual(['fishing', 'surfing']);
    expect(keys('lure-ball', 2)).toEqual(['fishing']);
    expect(keys('lure-ball', 9)).toContain('surfing');
    expect(keys('repeat-ball', 3)).toEqual(['alreadyCaught']);
    expect(keys('level-ball', 2)).toEqual(['playerLevel']);
    expect(keys('love-ball', 2)).toEqual(['loveMatch']);
    expect(keys('poke-ball', 5)).toEqual(['captureBonus', 'darkGrass', 'speciesCaught']);
    expect(keys('dive-ball', 5)).toEqual([
      'captureBonus',
      'darkGrass',
      'fishing',
      'speciesCaught',
      'surfing',
      'underwater',
    ]);
    expect(keys('poke-ball', 8)).toEqual(['catchingCharm', 'speciesCaught', 'underLevelPenalty']);
    expect(keys('poke-ball', 9)).toEqual([
      'badges',
      'catchingCharm',
      'catchingPower',
      'offGuard',
      'speciesCaught',
    ]);
  });

  it('offers the capture boosts of Gen 5–7 only', () => {
    expect(captureBonusOptions(5)).toEqual([100, 110, 120, 130]);
    expect(captureBonusOptions(6)).toEqual([100, 150, 200, 250]);
    expect(captureBonusOptions(7)).toEqual([100, 200]);
    expect(captureBonusOptions(8)).toEqual([]);
  });
});

describe('result formatting', () => {
  it('shows percentages and expected throws', () => {
    expect(formatChance(0.472783)).toBe('47.27');
    expect(formatChance(1)).toBe('100');
    expect(formatChance(0.00001)).toBe('<0.01');
    expect(formatChance(0)).toBe('0.00');
    expect(expectedThrows(0.25)).toBe(4);
    expect(expectedThrows(0)).toBeNull();
  });
});
