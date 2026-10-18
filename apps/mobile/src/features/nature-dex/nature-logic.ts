import type { NamedEntity, NatureEntry } from '@thedex/db';

export interface NatureMatrix {
  /** Stats of the rows (raised) and columns (lowered), in the games' order. */
  readonly stats: readonly NamedEntity[];
  /** `cells[row][column]`: the nature raising `stats[row]` and lowering `stats[column]`. */
  readonly cells: readonly (readonly (NatureEntry | null)[])[];
}

const SIZE = 5;

/**
 * The 5 × 5 nature matrix (RF07.2): natures are numbered row × 5 + column in the games, so the
 * diagonal holds the five neutral natures (Hardy, Docile, Serious, Bashful, Quirky).
 */
export function natureMatrix(natures: readonly NatureEntry[]): NatureMatrix {
  const cells: (NatureEntry | null)[][] = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => null),
  );
  const stats: (NamedEntity | null)[] = Array.from({ length: SIZE }, () => null);
  for (const nature of natures) {
    const row = Math.floor(nature.gameIndex / SIZE);
    const column = nature.gameIndex % SIZE;
    if (row >= SIZE) continue;
    cells[row]![column] = nature;
    if (nature.increased) stats[row] = nature.increased;
  }
  return {
    stats: stats.filter((stat): stat is NamedEntity => stat !== null),
    cells,
  };
}
