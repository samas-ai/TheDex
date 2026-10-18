import { describe, expect, it } from 'vitest';
import { applySearch } from './search-filter';

describe('applySearch', () => {
  it('keeps the list order and only the hits', () => {
    const entries = [{ id: 3 }, { id: 1 }, { id: 2 }];
    expect(applySearch(entries, new Set([2, 3]))).toEqual([{ id: 3 }, { id: 2 }]);
    expect(applySearch(entries, null)).toBe(entries);
  });
});
