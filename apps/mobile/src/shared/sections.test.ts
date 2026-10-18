import { describe, expect, it } from 'vitest';
import { toSectionRows } from './sections';

describe('toSectionRows', () => {
  it('interleaves headers in section order and drops empty sections', () => {
    const rows = toSectionRows(
      [
        { id: 1, kind: 'route' },
        { id: 2, kind: 'city' },
        { id: 3, kind: 'route' },
      ],
      ['city', 'cave', 'route'],
      (item) => item.kind as 'city' | 'cave' | 'route',
      (item) => String(item.id),
    );
    expect(rows.map((row) => (row.type === 'header' ? row.header : row.item.id))).toEqual([
      'city',
      2,
      'route',
      1,
      3,
    ]);
    expect(rows[0]?.key).toBe('header:city');
  });
});
