import { toggleTypePair } from '../../entities/type/type-matchups';
import type {
  CaptureStatus,
  PokedexEntry,
  PokedexFilters,
  PokedexSortKey,
  SortDirection,
} from '@thedex/db';

/** Checklist scope used by the capture filter until per-game checklists arrive (RF09). */
export const CAPTURE_SCOPE = 'national';

/** Filter state of the Pokédex screen (RF01.3). */
export interface PokedexFilterState {
  readonly typeIds: readonly number[];
  readonly generationIds: readonly number[];
  readonly regionIds: readonly number[];
  readonly tags: readonly string[];
  readonly abilityId: number | null;
  readonly eggGroupId: number | null;
  readonly capture: CaptureStatus | null;
  readonly includeForms: boolean;
}

export interface PokedexSort {
  readonly key: PokedexSortKey;
  readonly direction: SortDirection;
}

export const EMPTY_FILTERS: PokedexFilterState = {
  typeIds: [],
  generationIds: [],
  regionIds: [],
  tags: [],
  abilityId: null,
  eggGroupId: null,
  capture: null,
  includeForms: true,
};

export const DEFAULT_SORT: PokedexSort = { key: 'number', direction: 'asc' };

export function activeFilterCount(filters: PokedexFilterState): number {
  return (
    filters.typeIds.length +
    filters.generationIds.length +
    filters.regionIds.length +
    filters.tags.length +
    (filters.abilityId === null ? 0 : 1) +
    (filters.eggGroupId === null ? 0 : 1) +
    (filters.capture === null ? 0 : 1) +
    (filters.includeForms ? 0 : 1)
  );
}

export { toggle } from '../../shared/toggle';

/** Type filter: at most two types combined; a third replaces the oldest. */
export function toggleType(typeIds: readonly number[], id: number): number[] {
  return toggleTypePair(typeIds, id);
}

/** Repository query for the UI state. */
export function toRepoFilters(filters: PokedexFilterState): PokedexFilters {
  return {
    typeIds: filters.typeIds,
    generationIds: filters.generationIds,
    regionIds: filters.regionIds,
    tags: filters.tags,
    abilityId: filters.abilityId,
    eggGroupId: filters.eggGroupId,
    capture: filters.capture ? { scope: CAPTURE_SCOPE, status: filters.capture } : null,
    includeForms: filters.includeForms,
  };
}

/** Choosing the active key flips the direction; another key starts at its natural one. */
export function nextSort(current: PokedexSort, key: PokedexSortKey): PokedexSort {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  const descendingFirst = key !== 'number' && key !== 'national' && key !== 'name';
  return { key, direction: descendingFirst ? 'desc' : 'asc' };
}

/** Value shown at the end of a row for measurement/stat sorts (null for number/name sorts). */
export function sortValue(entry: PokedexEntry, key: PokedexSortKey): number | null {
  const stats = entry.stats;
  switch (key) {
    case 'height':
      return entry.heightDm / 10;
    case 'weight':
      return entry.weightHg / 10;
    case 'bst':
      return stats?.bst ?? null;
    case 'hp':
      return stats?.hp ?? null;
    case 'attack':
      return stats?.attack ?? null;
    case 'defense':
      return stats?.defense ?? null;
    case 'special-attack':
      return stats?.specialAttack ?? null;
    case 'special-defense':
      return stats?.specialDefense ?? null;
    case 'speed':
      return stats?.speed ?? null;
    default:
      return null;
  }
}

export { applySearch } from '../../shared/search-filter';
