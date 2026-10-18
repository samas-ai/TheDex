import { describe, expect, it } from 'vitest';
import {
  FLAVOR_BY_STAT,
  isNatureName,
  NATURE_NAMES,
  natureFlavors,
  natureMultiplier,
  NATURES,
} from './natures';

describe('natures', () => {
  it('defines all 25 natures, 5 of them neutral', () => {
    expect(NATURE_NAMES).toHaveLength(25);
    const neutral = NATURE_NAMES.filter((n) => NATURES[n].increased === null);
    expect(neutral.sort()).toEqual(['bashful', 'docile', 'hardy', 'quirky', 'serious']);
  });

  it('pairs every boosted stat with every lowered stat exactly once', () => {
    const pairs = new Set(
      NATURE_NAMES.filter((n) => NATURES[n].increased !== null).map(
        (n) => `${NATURES[n].increased}>${NATURES[n].decreased}`,
      ),
    );
    expect(pairs.size).toBe(20);
  });

  it('recognises nature identifiers', () => {
    expect(isNatureName('adamant')).toBe(true);
    expect(isNatureName('toString')).toBe(false);
    expect(isNatureName('angry')).toBe(false);
  });

  it('applies +10% / -10% multipliers and never touches HP', () => {
    expect(natureMultiplier('adamant', 'attack')).toBe(1.1);
    expect(natureMultiplier('adamant', 'special-attack')).toBe(0.9);
    expect(natureMultiplier('adamant', 'speed')).toBe(1);
    expect(natureMultiplier('adamant', 'hp')).toBe(1);
    expect(natureMultiplier('hardy', 'attack')).toBe(1);
  });

  it('derives liked and disliked flavors', () => {
    expect(natureFlavors('modest')).toEqual({ likes: 'dry', hates: 'spicy' });
    expect(natureFlavors('jolly')).toEqual({ likes: 'sweet', hates: 'dry' });
    expect(natureFlavors('serious')).toBeNull();
    expect(Object.keys(FLAVOR_BY_STAT)).toHaveLength(5);
  });
});
