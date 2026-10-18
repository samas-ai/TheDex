/** A flattened sectioned list for FlashList: section headers interleaved with items. */
export type SectionRow<H, T> =
  | { readonly type: 'header'; readonly key: string; readonly header: H }
  | { readonly type: 'item'; readonly key: string; readonly item: T };

/**
 * Groups `items` by `sectionOf` in `order` (empty sections dropped) and flattens them into
 * header + item rows. Items keep their order inside a section.
 */
export function toSectionRows<H extends string, T>(
  items: readonly T[],
  order: readonly H[],
  sectionOf: (item: T) => H,
  itemKey: (item: T) => string,
): SectionRow<H, T>[] {
  const bySection = new Map<H, T[]>();
  for (const item of items) {
    const section = sectionOf(item);
    bySection.set(section, [...(bySection.get(section) ?? []), item]);
  }
  return order.flatMap((header): SectionRow<H, T>[] => {
    const list = bySection.get(header) ?? [];
    if (list.length === 0) return [];
    return [
      { type: 'header', key: `header:${header}`, header },
      ...list.map((item) => ({ type: 'item' as const, key: itemKey(item), item })),
    ];
  });
}
