import { normalizeSearchText } from '@thedex/db';

/** A choice in a picker (moves, items, natures, balls…). */
export interface PickerOption<K> {
  readonly key: K;
  readonly title: string;
  readonly subtitle?: string | null;
  /** Extra text matched by the search (identifiers, English names…). */
  readonly keywords?: string;
}

/**
 * Options whose title, subtitle or keywords contain every word of `query`, with the same
 * normalization as the FTS search (accents, case, kana, punctuation). Order is kept.
 */
export function filterOptions<K, T extends PickerOption<K>>(
  options: readonly T[],
  query: string,
): readonly T[] {
  const words = normalizeSearchText(query).split(' ').filter(Boolean);
  if (words.length === 0) return options;
  return options.filter((option) => {
    const text = normalizeSearchText(
      `${option.title} ${option.subtitle ?? ''} ${option.keywords ?? ''}`,
    );
    return words.every((word) => text.includes(word));
  });
}

/** Integer typed in a number field, clamped to [min, max]; null while it is not a number. */
export function parseClamped(text: string, min: number, max: number): number | null {
  const digits = text.replace(/[^0-9]/g, '');
  if (digits === '') return null;
  return Math.max(min, Math.min(max, Number(digits)));
}
