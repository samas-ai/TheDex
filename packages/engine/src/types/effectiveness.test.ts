import { describe, expect, it } from 'vitest';
import { assertGeneration, isGeneration, LATEST_GENERATION, type Generation } from '../generations';
import { chartMultiplier } from './chart';
import {
  defensiveMultipliers,
  effectiveness,
  legacyDamageClass,
  offensiveMultipliers,
} from './effectiveness';
import { isTypeName, TYPE_NAMES, typeIntroducedIn, typesInGeneration } from './type-names';

describe('generations', () => {
  it('validates generation numbers', () => {
    expect(isGeneration(1)).toBe(true);
    expect(isGeneration(LATEST_GENERATION)).toBe(true);
    expect(isGeneration(0)).toBe(false);
    expect(isGeneration(10)).toBe(false);
    expect(isGeneration(2.5)).toBe(false);
    expect(assertGeneration(4)).toBe(4);
    expect(() => assertGeneration(11)).toThrow(RangeError);
  });
});

describe('type names', () => {
  it('lists 18 types and recognises identifiers', () => {
    expect(TYPE_NAMES).toHaveLength(18);
    expect(isTypeName('fairy')).toBe(true);
    expect(isTypeName('stellar')).toBe(false);
  });

  it('knows when types were introduced', () => {
    expect(typeIntroducedIn('fire')).toBe(1);
    expect(typeIntroducedIn('dark')).toBe(2);
    expect(typeIntroducedIn('steel')).toBe(2);
    expect(typeIntroducedIn('fairy')).toBe(6);
  });

  it('filters types by generation', () => {
    expect(typesInGeneration(1)).toHaveLength(15);
    expect(typesInGeneration(1)).not.toContain('dark');
    expect(typesInGeneration(5)).toHaveLength(17);
    expect(typesInGeneration(5)).not.toContain('fairy');
    expect(typesInGeneration(9)).toHaveLength(18);
  });
});

describe('chartMultiplier', () => {
  it.each([
    ['fire', 'grass', 9, 2],
    ['water', 'water', 9, 0.5],
    ['normal', 'ghost', 9, 0],
    ['electric', 'ground', 9, 0],
    ['dragon', 'fairy', 9, 0],
    ['poison', 'steel', 9, 0],
    ['psychic', 'dark', 9, 0],
    ['fighting', 'ghost', 9, 0],
    ['ground', 'flying', 9, 0],
    ['ghost', 'normal', 9, 0],
    ['fire', 'normal', 9, 1],
  ] as const)('%s -> %s in gen %i is %d', (atk, def, gen, expected) => {
    expect(chartMultiplier(atk, def, gen as Generation)).toBe(expected);
  });

  it('applies the Gen 2-5 Steel resistances to Ghost and Dark', () => {
    expect(chartMultiplier('ghost', 'steel', 2)).toBe(0.5);
    expect(chartMultiplier('dark', 'steel', 5)).toBe(0.5);
    expect(chartMultiplier('ghost', 'steel', 6)).toBe(1);
    expect(chartMultiplier('dark', 'steel', 6)).toBe(1);
  });

  it('applies the Gen 1 quirks', () => {
    expect(chartMultiplier('ghost', 'psychic', 1)).toBe(0);
    expect(chartMultiplier('ghost', 'psychic', 2)).toBe(2);
    expect(chartMultiplier('bug', 'poison', 1)).toBe(2);
    expect(chartMultiplier('bug', 'poison', 2)).toBe(0.5);
    expect(chartMultiplier('poison', 'bug', 1)).toBe(2);
    expect(chartMultiplier('poison', 'bug', 2)).toBe(1);
    expect(chartMultiplier('ice', 'fire', 1)).toBe(1);
    expect(chartMultiplier('ice', 'fire', 2)).toBe(0.5);
  });
});

describe('effectiveness', () => {
  it('multiplies across dual types (4x, 0.25x and immunities)', () => {
    expect(effectiveness('water', ['rock', 'ground'], 9)).toBe(4);
    expect(effectiveness('ice', ['dragon', 'flying'], 9)).toBe(4);
    expect(effectiveness('fire', ['fire', 'dragon'], 9)).toBe(0.25);
    expect(effectiveness('ground', ['electric', 'flying'], 9)).toBe(0);
    expect(effectiveness('fairy', ['fighting', 'dark'], 9)).toBe(4);
  });

  it('respects Fairy before and after Gen 6 (Clefairy case)', () => {
    expect(effectiveness('dragon', ['normal'], 5)).toBe(1);
    expect(effectiveness('dragon', ['fairy'], 6)).toBe(0);
    expect(() => effectiveness('dragon', ['fairy'], 5)).toThrow(/does not exist/);
    expect(() => effectiveness('fairy', ['normal'], 5)).toThrow(/does not exist/);
  });

  it('rejects invalid defender typings', () => {
    expect(() => effectiveness('fire', [], 9)).toThrow(/Expected 1 or 2/);
    expect(() => effectiveness('fire', ['grass', 'bug', 'ice'], 9)).toThrow(/Expected 1 or 2/);
    expect(() => effectiveness('fire', ['grass', 'grass'], 9)).toThrow(/Duplicate/);
  });
});

describe('defensiveMultipliers', () => {
  it('covers every attacking type of the generation', () => {
    const charizard = defensiveMultipliers(['fire', 'flying'], 9);
    expect(Object.keys(charizard)).toHaveLength(18);
    expect(charizard.rock).toBe(4);
    expect(charizard.ground).toBe(0);
    expect(charizard.grass).toBe(0.25);
    expect(charizard.bug).toBe(0.25);
    expect(charizard.water).toBe(2);
  });

  it('uses the generation-specific chart', () => {
    const gen1Gengar = defensiveMultipliers(['ghost', 'poison'], 1);
    expect(Object.keys(gen1Gengar)).toHaveLength(15);
    expect(gen1Gengar.bug).toBe(1); // 2x from Bug vs Poison, 0.5x vs Ghost
    expect(gen1Gengar.psychic).toBe(2);
    const gen5Scizor = defensiveMultipliers(['bug', 'steel'], 5);
    expect(gen5Scizor.ghost).toBe(0.5);
    expect(gen5Scizor.fire).toBe(4);
  });
});

describe('offensiveMultipliers', () => {
  it('lists the matchup against every defending type', () => {
    const fairy = offensiveMultipliers('fairy', 9);
    expect(fairy.dragon).toBe(2);
    expect(fairy.steel).toBe(0.5);
    expect(offensiveMultipliers('dark', 2).steel).toBe(0.5);
  });
});

describe('legacyDamageClass', () => {
  it('maps every pre-Gen 4 type to physical or special', () => {
    expect(legacyDamageClass('normal')).toBe('physical');
    expect(legacyDamageClass('ghost')).toBe('physical');
    expect(legacyDamageClass('steel')).toBe('physical');
    expect(legacyDamageClass('fire')).toBe('special');
    expect(legacyDamageClass('dark')).toBe('special');
    expect(legacyDamageClass('electric')).toBe('special');
  });

  it('rejects Fairy', () => {
    expect(() => legacyDamageClass('fairy')).toThrow(RangeError);
  });
});
