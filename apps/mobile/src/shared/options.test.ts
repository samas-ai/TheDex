import { describe, expect, it } from 'vitest';
import { filterOptions, parseClamped } from './options';

describe('filterOptions', () => {
  const options = [
    { key: 1, title: 'Thunderbolt', subtitle: 'Elétrico' },
    { key: 2, title: 'Flamethrower', subtitle: 'Fogo', keywords: 'lança-chamas' },
    { key: 3, title: 'Thunder Wave', subtitle: null },
  ];

  it('matches every word against title, subtitle and keywords, accent-insensitively', () => {
    expect(filterOptions(options, '').map((o) => o.key)).toEqual([1, 2, 3]);
    expect(filterOptions(options, 'thunder').map((o) => o.key)).toEqual([1, 3]);
    expect(filterOptions(options, 'eletrico').map((o) => o.key)).toEqual([1]);
    expect(filterOptions(options, 'lanca chamas').map((o) => o.key)).toEqual([2]);
    expect(filterOptions(options, 'thunder wave').map((o) => o.key)).toEqual([3]);
    expect(filterOptions(options, 'surf')).toEqual([]);
  });
});

describe('parseClamped', () => {
  it('keeps digits and clamps', () => {
    expect(parseClamped('', 0, 31)).toBeNull();
    expect(parseClamped('-', 0, 31)).toBeNull();
    expect(parseClamped('12', 0, 31)).toBe(12);
    expect(parseClamped('99', 0, 31)).toBe(31);
    expect(parseClamped('0', 1, 100)).toBe(1);
    expect(parseClamped('2a5', 0, 252)).toBe(25);
  });
});
