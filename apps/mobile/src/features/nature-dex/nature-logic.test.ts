import { describe, expect, it } from 'vitest';
import type { NamedEntity, NatureEntry } from '@thedex/db';
import { natureMatrix } from './nature-logic';

const STATS = ['attack', 'defense', 'speed', 'special-attack', 'special-defense'];
const stat = (index: number): NamedEntity => ({
  id: index + 2,
  identifier: STATS[index]!,
  name: STATS[index]!,
});

/** The 25 natures as PokeAPI numbers them (row = raised stat, column = lowered stat). */
const NATURES: NatureEntry[] = Array.from({ length: 25 }, (_, gameIndex) => {
  const row = Math.floor(gameIndex / 5);
  const column = gameIndex % 5;
  const neutral = row === column;
  return {
    id: gameIndex + 1,
    identifier: `nature-${gameIndex}`,
    name: `Nature ${gameIndex}`,
    increased: neutral ? null : stat(row),
    decreased: neutral ? null : stat(column),
    likes: null,
    hates: null,
    gameIndex,
  };
});

describe('natureMatrix (RF07.2)', () => {
  it('places natures by raised (row) and lowered (column) stat, neutrals on the diagonal', () => {
    const matrix = natureMatrix(NATURES);
    expect(matrix.stats.map((s) => s.identifier)).toEqual(STATS);
    expect(matrix.cells[0]?.[0]?.increased).toBeNull();
    expect(matrix.cells[0]?.[3]?.name).toBe('Nature 3');
    expect(matrix.cells[3]?.[0]).toMatchObject({
      increased: { identifier: 'special-attack' },
      decreased: { identifier: 'attack' },
    });
    expect(matrix.cells.flat().filter((cell) => cell?.increased === null)).toHaveLength(5);
  });

  it('leaves missing natures empty', () => {
    const matrix = natureMatrix(NATURES.slice(0, 2));
    expect(matrix.cells[0]?.[1]?.name).toBe('Nature 1');
    expect(matrix.cells[1]?.[0]).toBeNull();
    expect(matrix.stats).toHaveLength(1);
  });
});
