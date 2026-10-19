import { describe, expect, it } from 'vitest';
import { entityHref } from './entity-href';

describe('entityHref', () => {
  it('opens each entity on its screen', () => {
    expect(entityHref('pokemon', 6)).toBe('/pokemon/6');
    expect(entityHref('move', 85)).toBe('/move/85');
    expect(entityHref('ability', 65)).toBe('/ability/65');
    expect(entityHref('item', 17)).toBe('/item/17');
    expect(entityHref('location', 155)).toBe('/location/155');
    expect(entityHref('type', 10)).toBe('/types?type=10');
    expect(entityHref('nature', 3)).toBe('/natures');
  });
});
