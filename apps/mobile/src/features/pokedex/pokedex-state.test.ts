import { describe, expect, it } from 'vitest';
import type { PokedexEntry } from '@thedex/db';
import {
  activeFilterCount,
  applySearch,
  EMPTY_FILTERS,
  nextSort,
  sortValue,
  toggle,
  toggleType,
  toRepoFilters,
} from './pokedex-state';

const entry = (id: number): PokedexEntry => ({
  id,
  identifier: `p${id}`,
  speciesId: id,
  nationalNumber: id,
  regionalNumber: null,
  pokedexId: null,
  isDefault: true,
  name: `P${id}`,
  types: ['fire'],
  heightDm: 17,
  weightHg: 905,
  stats: {
    hp: 78,
    attack: 84,
    defense: 78,
    specialAttack: 109,
    specialDefense: 85,
    speed: 100,
    bst: 534,
  },
});

describe('pokedex state', () => {
  it('counts active filters', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(
      activeFilterCount({
        ...EMPTY_FILTERS,
        typeIds: [10, 3],
        capture: 'caught',
        includeForms: false,
      }),
    ).toBe(4);
  });

  it('combines at most two types', () => {
    expect(toggleType([], 10)).toEqual([10]);
    expect(toggleType([10], 3)).toEqual([10, 3]);
    expect(toggleType([10, 3], 11)).toEqual([3, 11]);
    expect(toggleType([10, 3], 10)).toEqual([3]);
    expect(toggle([1, 2], 2)).toEqual([1]);
    expect(toggle([1], 2)).toEqual([1, 2]);
  });

  it('maps the capture filter to the checklist collection', () => {
    expect(toRepoFilters({ ...EMPTY_FILTERS, capture: 'shiny' }, 'game:25').capture).toEqual({
      scope: 'game:25',
      status: 'shiny',
    });
    expect(toRepoFilters(EMPTY_FILTERS, 'national').capture).toBeNull();
  });

  it('flips direction on the active key and starts stats descending', () => {
    expect(nextSort({ key: 'number', direction: 'asc' }, 'number')).toEqual({
      key: 'number',
      direction: 'desc',
    });
    expect(nextSort({ key: 'number', direction: 'asc' }, 'speed').direction).toBe('desc');
    expect(nextSort({ key: 'speed', direction: 'desc' }, 'name').direction).toBe('asc');
  });

  it('shows the sorted measurement or stat on each row', () => {
    const charizard = entry(6);
    expect(sortValue(charizard, 'height')).toBe(1.7);
    expect(sortValue(charizard, 'weight')).toBe(90.5);
    expect(sortValue(charizard, 'special-attack')).toBe(109);
    expect(sortValue(charizard, 'bst')).toBe(534);
    expect(sortValue(charizard, 'name')).toBeNull();
    expect(sortValue({ ...charizard, stats: null }, 'speed')).toBeNull();
  });

  it('intersects search hits without changing the order', () => {
    const list = [entry(3), entry(1), entry(2)];
    expect(applySearch(list, null)).toBe(list);
    expect(applySearch(list, new Set([2, 3])).map((e) => e.id)).toEqual([3, 2]);
  });
});
