/**
 * Applies a search (entity ids from `searchQuery`) to a filtered list, keeping the list's sort
 * order. `null` = no search.
 */
export function applySearch<T extends { readonly id: number }>(
  entries: readonly T[],
  hits: ReadonlySet<number> | null,
): readonly T[] {
  return hits === null ? entries : entries.filter((entry) => hits.has(entry.id));
}
