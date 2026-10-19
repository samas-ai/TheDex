import { describe, expect, it } from 'vitest';
import type { ChecklistDexEntry } from '@thedex/db';
import {
  batchLevel,
  BOX_SIZE,
  checklistGroups,
  checklistProgress,
  checklistRows,
  flagsOf,
  levelOf,
  levelsById,
  matchesFilter,
  percentOf,
  tapLevel,
} from './checklist-logic';

const entry = (pokemonId: number, generationId = 1): ChecklistDexEntry => ({
  pokemonId,
  speciesId: pokemonId,
  number: pokemonId,
  generationId,
  name: `#${pokemonId}`,
  types: [],
});

describe('levels', () => {
  it('reads the flags as one level and back', () => {
    expect(levelOf(undefined)).toBe(0);
    expect(levelOf({ seen: false, caught: false, shinyCaught: false })).toBe(0);
    expect(levelOf({ seen: true, caught: false, shinyCaught: false })).toBe(1);
    expect(levelOf({ seen: false, caught: true, shinyCaught: false })).toBe(2);
    expect(levelOf({ seen: false, caught: false, shinyCaught: true })).toBe(3);
    expect(flagsOf(0)).toEqual({ seen: false, caught: false, shinyCaught: false });
    expect(flagsOf(2)).toEqual({ seen: true, caught: true, shinyCaught: false });
    expect(flagsOf(3)).toEqual({ seen: true, caught: true, shinyCaught: true });
  });

  it('sets the tapped level, or steps back from the current one', () => {
    expect(tapLevel(0, 2)).toBe(2);
    expect(tapLevel(2, 2)).toBe(1);
    expect(tapLevel(3, 1)).toBe(1);
    expect(tapLevel(1, 1)).toBe(0);
    expect(tapLevel(3, 3)).toBe(2);
  });

  it('only raises marks in batches, except clearing', () => {
    expect(batchLevel(3, 2)).toBe(3);
    expect(batchLevel(1, 2)).toBe(2);
    expect(batchLevel(0, 1)).toBe(1);
    expect(batchLevel(3, 0)).toBe(0);
  });

  it('keeps default forms only', () => {
    const levels = levelsById([
      { pokemonId: 25, formId: 0, seen: true, caught: true, shinyCaught: false },
      { pokemonId: 201, formId: 7, seen: true, caught: false, shinyCaught: false },
    ]);
    expect([...levels]).toEqual([[25, 2]]);
  });
});

describe('filters and progress (RF09.2)', () => {
  it('filters for Living Dex and shiny hunting', () => {
    expect([0, 1, 2, 3].map((l) => matchesFilter(l as 0, 'all'))).toEqual([true, true, true, true]);
    expect([0, 1, 2, 3].map((l) => matchesFilter(l as 0, 'missing-caught'))).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect([0, 1, 2, 3].map((l) => matchesFilter(l as 0, 'missing-shiny'))).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect([0, 1, 2, 3].map((l) => matchesFilter(l as 0, 'caught'))).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it('counts the whole collection', () => {
    const entries = [entry(1), entry(2), entry(3), entry(4)];
    const levels = new Map([
      [1, 3],
      [2, 2],
      [3, 1],
    ] as const);
    expect(checklistProgress(entries, levels)).toEqual({ total: 4, seen: 3, caught: 2, shiny: 1 });
  });

  it('formats percentages without rounding up to 100', () => {
    expect(percentOf(450, 1025)).toBe('43.9');
    expect(percentOf(1, 2)).toBe('50');
    expect(percentOf(1024, 1025)).toBe('99.9');
    expect(percentOf(0, 0)).toBe('0');
  });
});

describe('groups (RF09.1 batches)', () => {
  it('groups the National Dex by generation', () => {
    const groups = checklistGroups([entry(1), entry(2), entry(152, 2)], 'national');
    expect(groups.map((g) => [g.key, g.kind, g.number, g.entries.length])).toEqual([
      ['national:1', 'generation', 1, 2],
      ['national:2', 'generation', 2, 1],
    ]);
  });

  it('cuts a game dex into fixed boxes of 30', () => {
    const entries = Array.from({ length: 65 }, (_, i) => entry(i + 1));
    const groups = checklistGroups(entries, 'game');
    expect(groups.map((g) => [g.kind, g.number, g.entries.length])).toEqual([
      ['box', 1, BOX_SIZE],
      ['box', 2, BOX_SIZE],
      ['box', 3, 5],
    ]);
    // Filtering keeps box numbers and drops empty boxes.
    const rows = checklistRows(groups, (e) => e.pokemonId > 55);
    expect(
      rows.map((row) => (row.type === 'header' ? `box ${row.group.number}` : row.key)),
    ).toEqual(['box 2', '56', '57', '58', '59', '60', 'box 3', '61', '62', '63', '64', '65']);
  });
});
