import { describe, expect, it } from 'vitest';
import { abilityImmunity, applyDefensiveAbility } from './abilities';

describe('defensive abilities', () => {
  it('knows type immunities and when they started', () => {
    expect(abilityImmunity('levitate', 3)).toBe('ground');
    expect(abilityImmunity('lightning-rod', 4)).toBeNull();
    expect(abilityImmunity('lightning-rod', 5)).toBe('electric');
    expect(abilityImmunity('well-baked-body', 9)).toBe('fire');
    expect(abilityImmunity('intimidate', 9)).toBeNull();
  });

  it('cancels the immune type only', () => {
    expect(applyDefensiveAbility(2, 'ground', 'levitate', 9)).toBe(0);
    expect(applyDefensiveAbility(2, 'fire', 'levitate', 9)).toBe(2);
    expect(applyDefensiveAbility(2, 'ground', null, 9)).toBe(2);
    expect(applyDefensiveAbility(0.5, 'water', 'storm-drain', 4)).toBe(0.5);
  });

  it('lets only super-effective hits through Wonder Guard', () => {
    expect(applyDefensiveAbility(1, 'normal', 'wonder-guard', 3)).toBe(0);
    expect(applyDefensiveAbility(0.5, 'grass', 'wonder-guard', 9)).toBe(0);
    expect(applyDefensiveAbility(2, 'fire', 'wonder-guard', 3)).toBe(2);
    // Abilities did not exist before Gen 3.
    expect(applyDefensiveAbility(1, 'normal', 'wonder-guard', 2)).toBe(1);
  });
});
