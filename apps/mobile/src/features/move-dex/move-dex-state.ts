import type { DamageClass, MoveFilters, MoveListEntry, MoveSortKey } from '@thedex/db';
import { formatMoveValue, formatPriority } from '../../entities/move/move-format';
import { toggle } from '../../shared/toggle';

/** Filter state of the Move Dex (RF03.1). */
export interface MoveFilterState {
  readonly typeIds: readonly number[];
  readonly damageClasses: readonly DamageClass[];
  readonly generationIds: readonly number[];
  /** Only moves some Pokémon learns in the selected game. */
  readonly learnableOnly: boolean;
}

export interface MoveSort {
  readonly key: MoveSortKey;
  readonly direction: 'asc' | 'desc';
}

/** Defaults: the game's own moves, when PokeAPI has its learnsets. */
export function defaultMoveFilters(hasLearnsets: boolean): MoveFilterState {
  return { typeIds: [], damageClasses: [], generationIds: [], learnableOnly: hasLearnsets };
}

export const DEFAULT_MOVE_SORT: MoveSort = { key: 'name', direction: 'asc' };

/** Filters set apart from the defaults (the "Filters (n)" chip). */
export function activeMoveFilterCount(filters: MoveFilterState, hasLearnsets: boolean): number {
  return (
    filters.typeIds.length +
    filters.damageClasses.length +
    filters.generationIds.length +
    (filters.learnableOnly === hasLearnsets ? 0 : 1)
  );
}

/** Types are additive in the Move Dex (a move has one type): toggle any number. */
export function toggleMoveType(typeIds: readonly number[], id: number): number[] {
  return toggle(typeIds, id);
}

export function toggleDamageClass(
  classes: readonly DamageClass[],
  damageClass: DamageClass,
): DamageClass[] {
  return toggle(classes, damageClass);
}

export function toRepoMoveFilters(filters: MoveFilterState): MoveFilters {
  return { ...filters };
}

/** The active key flips the direction; numbers start high, names and generations low. */
export function nextMoveSort(current: MoveSort, key: MoveSortKey): MoveSort {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: key === 'name' || key === 'generation' ? 'asc' : 'desc' };
}

/** Value shown at the end of a row for the sort key (null when the row already shows it). */
export function moveSortValue(move: MoveListEntry, key: MoveSortKey): string | null {
  switch (key) {
    case 'accuracy':
      return move.accuracy === null ? '—' : `${move.accuracy}%`;
    case 'pp':
      return formatMoveValue(move.pp);
    case 'priority':
      return formatPriority(move.priority);
    case 'generation':
      return String(move.generationId);
    default:
      return null;
  }
}
