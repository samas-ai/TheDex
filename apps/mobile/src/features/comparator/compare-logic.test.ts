import { describe, expect, it } from 'vitest';
import { bestIndices, parseCompareIds, weaknessesOf } from './compare-logic';

describe('parseCompareIds', () => {
  it('keeps unique positive integers, at most six', () => {
    expect(parseCompareIds('6, 9,6,x,-1,0,3.5,3')).toEqual([6, 9, 3]);
    expect(parseCompareIds(['1,2', '3'])).toEqual([1, 2, 3]);
    expect(parseCompareIds(undefined)).toEqual([]);
    expect(parseCompareIds('1,2,3,4,5,6,7,8')).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('bestIndices', () => {
  it('marks every column tied for the best value', () => {
    expect([...bestIndices([80, 100, 100, null])]).toEqual([1, 2]);
    expect([...bestIndices([80, null])]).toEqual([]);
    expect([...bestIndices([])]).toEqual([]);
  });
});

describe('weaknessesOf', () => {
  it('lists super-effective types, ×4 first, as of the generation', () => {
    expect(weaknessesOf(['grass', 'flying'], 9)).toEqual([
      { type: 'ice', multiplier: 4 },
      { type: 'flying', multiplier: 2 },
      { type: 'poison', multiplier: 2 },
      { type: 'rock', multiplier: 2 },
      { type: 'fire', multiplier: 2 },
    ]);
    // Gen 1: Ghost does nothing to Psychic, and Bug was super effective on Poison.
    expect(weaknessesOf(['poison'], 1).map((w) => w.type)).toEqual(['ground', 'bug', 'psychic']);
    expect(weaknessesOf(['shadow'], 9)).toEqual([]);
  });
});
