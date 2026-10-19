import type { ChecklistDexEntry, ChecklistEntry, ChecklistFlags, ChecklistKind } from '@thedex/db';

/**
 * A Pokémon's mark in a collection (RF09.1), as one level: shiny caught implies caught, caught
 * implies seen (the Pokédex capture filter reads the flags the same way).
 */
export type ChecklistLevel = 0 | 1 | 2 | 3;
export const LEVEL_NAMES = ['none', 'seen', 'caught', 'shiny'] as const;

export function levelOf(flags: ChecklistFlags | undefined): ChecklistLevel {
  if (!flags) return 0;
  if (flags.shinyCaught) return 3;
  if (flags.caught) return 2;
  return flags.seen ? 1 : 0;
}

export function flagsOf(level: ChecklistLevel): ChecklistFlags {
  return { seen: level >= 1, caught: level >= 2, shinyCaught: level >= 3 };
}

/** Tapping a mark sets that level; tapping the current one steps back one level. */
export function tapLevel(current: ChecklistLevel, tapped: 1 | 2 | 3): ChecklistLevel {
  return current === tapped ? ((tapped - 1) as ChecklistLevel) : tapped;
}

/**
 * Level after a batch mark (a whole generation or box): marks only go up, so marking a box as
 * caught keeps its shiny catches; clearing (0) resets everything.
 */
export function batchLevel(current: ChecklistLevel, chosen: ChecklistLevel): ChecklistLevel {
  return chosen === 0 ? 0 : (Math.max(current, chosen) as ChecklistLevel);
}

/** Levels by pokemon id (default forms only). */
export function levelsById(entries: readonly ChecklistEntry[]): Map<number, ChecklistLevel> {
  const levels = new Map<number, ChecklistLevel>();
  for (const entry of entries) {
    if (entry.formId === 0) levels.set(entry.pokemonId, levelOf(entry));
  }
  return levels;
}

/** Quick filters (RF09.2): Living Dex ("not caught") and Shiny hunting ("no shiny"). */
export const CHECKLIST_FILTERS = ['all', 'missing-caught', 'missing-shiny', 'caught'] as const;
export type ChecklistFilter = (typeof CHECKLIST_FILTERS)[number];

export function matchesFilter(level: ChecklistLevel, filter: ChecklistFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'missing-caught':
      return level < 2;
    case 'missing-shiny':
      return level < 3;
    case 'caught':
      return level >= 2;
  }
}

export interface ChecklistProgress {
  readonly total: number;
  readonly seen: number;
  readonly caught: number;
  readonly shiny: number;
}

/** Counts over the whole collection (RF09.2), whatever the filter. */
export function checklistProgress(
  entries: readonly ChecklistDexEntry[],
  levels: ReadonlyMap<number, ChecklistLevel>,
): ChecklistProgress {
  let seen = 0;
  let caught = 0;
  let shiny = 0;
  for (const entry of entries) {
    const level = levels.get(entry.pokemonId) ?? 0;
    if (level >= 1) seen++;
    if (level >= 2) caught++;
    if (level >= 3) shiny++;
  }
  return { total: entries.length, seen, caught, shiny };
}

/** `43.9` (one decimal, `0` for an empty collection, `100` only when complete). */
export function percentOf(done: number, total: number): string {
  if (total === 0) return '0';
  const value = Math.floor((done / total) * 1000) / 10;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Box of 30 (the PC box size) in a game checklist. */
export const BOX_SIZE = 30;

/** A batch-markable group (RF09.1): a generation of the National Dex or a box of a game. */
export interface ChecklistGroup {
  readonly key: string;
  readonly kind: 'generation' | 'box';
  readonly number: number;
  readonly entries: readonly ChecklistDexEntry[];
}

/** Groups in dex order; boxes are fixed by position, so filtering never renumbers them. */
export function checklistGroups(
  entries: readonly ChecklistDexEntry[],
  kind: ChecklistKind,
): ChecklistGroup[] {
  const groups: ChecklistGroup[] = [];
  entries.forEach((entry, index) => {
    const number = kind === 'national' ? entry.generationId : Math.floor(index / BOX_SIZE) + 1;
    const last = groups[groups.length - 1];
    if (last && last.number === number) {
      (last.entries as ChecklistDexEntry[]).push(entry);
    } else {
      groups.push({
        key: `${kind}:${number}`,
        kind: kind === 'national' ? 'generation' : 'box',
        number,
        entries: [entry],
      });
    }
  });
  return groups;
}

export type ChecklistRow =
  | { readonly type: 'header'; readonly key: string; readonly group: ChecklistGroup }
  | { readonly type: 'item'; readonly key: string; readonly entry: ChecklistDexEntry };

/** Flattened rows for the list: each group's header, then its entries that pass `keep`. */
export function checklistRows(
  groups: readonly ChecklistGroup[],
  keep: (entry: ChecklistDexEntry) => boolean,
): ChecklistRow[] {
  return groups.flatMap((group): ChecklistRow[] => {
    const entries = group.entries.filter(keep);
    if (entries.length === 0) return [];
    return [
      { type: 'header', key: group.key, group },
      ...entries.map((entry) => ({
        type: 'item' as const,
        key: String(entry.pokemonId),
        entry,
      })),
    ];
  });
}
