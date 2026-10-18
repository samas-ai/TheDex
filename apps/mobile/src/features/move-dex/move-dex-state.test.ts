import { describe, expect, it } from 'vitest';
import type { MoveListEntry } from '@thedex/db';
import {
  activeMoveFilterCount,
  defaultMoveFilters,
  moveSortValue,
  nextMoveSort,
  toggleDamageClass,
  toggleMoveType,
  toRepoMoveFilters,
} from './move-dex-state';

const MOVE: MoveListEntry = {
  id: 85,
  identifier: 'thunderbolt',
  name: 'Thunderbolt',
  generationId: 1,
  type: 'electric',
  damageClass: 'special',
  power: 90,
  accuracy: 100,
  pp: 15,
  priority: 0,
  variantKind: null,
};

describe('Move Dex filters (RF03.1)', () => {
  it('defaults to the game’s learnable moves when PokeAPI has its learnsets', () => {
    expect(defaultMoveFilters(true).learnableOnly).toBe(true);
    expect(defaultMoveFilters(false).learnableOnly).toBe(false);
    expect(activeMoveFilterCount(defaultMoveFilters(true), true)).toBe(0);
    expect(activeMoveFilterCount({ ...defaultMoveFilters(true), learnableOnly: false }, true)).toBe(
      1,
    );
  });

  it('counts and toggles types, categories and generations', () => {
    const filters = {
      ...defaultMoveFilters(false),
      typeIds: toggleMoveType(toggleMoveType([10], 13), 11),
      damageClasses: toggleDamageClass(toggleDamageClass([], 'special'), 'status'),
      generationIds: [1],
    };
    expect(filters.typeIds).toEqual([10, 13, 11]);
    expect(toggleMoveType(filters.typeIds, 13)).toEqual([10, 11]);
    expect(toggleDamageClass(filters.damageClasses, 'special')).toEqual(['status']);
    expect(activeMoveFilterCount(filters, false)).toBe(6);
    expect(toRepoMoveFilters(filters)).toEqual({
      typeIds: [10, 13, 11],
      damageClasses: ['special', 'status'],
      generationIds: [1],
      learnableOnly: false,
    });
  });
});

describe('Move Dex sort', () => {
  it('flips the active key and starts numbers high, names low', () => {
    expect(nextMoveSort({ key: 'name', direction: 'asc' }, 'name')).toEqual({
      key: 'name',
      direction: 'desc',
    });
    expect(nextMoveSort({ key: 'name', direction: 'asc' }, 'power').direction).toBe('desc');
    expect(nextMoveSort({ key: 'power', direction: 'desc' }, 'generation').direction).toBe('asc');
  });

  it('shows the sorted value when the row does not', () => {
    expect(moveSortValue(MOVE, 'name')).toBeNull();
    expect(moveSortValue(MOVE, 'power')).toBeNull();
    expect(moveSortValue(MOVE, 'accuracy')).toBe('100%');
    expect(moveSortValue({ ...MOVE, accuracy: null }, 'accuracy')).toBe('—');
    expect(moveSortValue(MOVE, 'pp')).toBe('15');
    expect(moveSortValue({ ...MOVE, priority: 1 }, 'priority')).toBe('+1');
    expect(moveSortValue(MOVE, 'generation')).toBe('1');
  });
});
