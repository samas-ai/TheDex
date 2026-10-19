import { toggleTypePair } from '../../entities/type/type-matchups';
import type {
  CaptureStatus,
  PokedexEntry,
  PokedexFilters,
  PokedexSortKey,
  SortDirection,
} from '@thedex/db';

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

/** Filter groups in use: types, generation, region, category, capture, egg group, ability. */
export function activeFilterGroups(filters: PokedexFilterState): number {
  return [
    filters.typeIds.length > 0,
    filters.generationIds.length > 0,
    filters.regionIds.length > 0,
    filters.tags.length > 0,
    filters.capture !== null,
    filters.eggGroupId !== null,
    filters.abilityId !== null,
  ].filter(Boolean).length;
}

/**
 * Whether a change needs combined filters (PRO, RNF08): it adds a second group or more. Changes
 * that do not add a group are always allowed, so filters left from a PRO session can be undone.
 */
export function needsCombinedFilters(
  current: PokedexFilterState,
  next: PokedexFilterState,
): boolean {
  const groups = activeFilterGroups(next);
  return groups > 1 && groups > activeFilterGroups(current);
}

export { toggle } from '../../shared/toggle';

/** Type filter: at most two types combined; a third replaces the oldest. */
export function toggleType(typeIds: readonly number[], id: number): number[] {
  return toggleTypePair(typeIds, id);
}

/**
 * Repository query for the UI state. `captureScope` is the checklist collection the capture
 * filter reads (`checklistScope` of the user's checklist setting, RF09).
 */
export function toRepoFilters(filters: PokedexFilterState, captureScope: string): PokedexFilters {
  return {
    typeIds: filters.typeIds,
    generationIds: filters.generationIds,
    regionIds: filters.regionIds,
    tags: filters.tags,
    abilityId: filters.abilityId,
    eggGroupId: filters.eggGroupId,
    capture: filters.capture ? { scope: captureScope, status: filters.capture } : null,
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
