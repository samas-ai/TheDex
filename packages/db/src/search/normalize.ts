const COMBINING_DIACRITICS = /[̀-ͯ]/g;
const HIRAGANA = /[ぁ-ゖ]/g;
const KATAKANA_OFFSET = 0x60;
/** Punctuation removed without leaving a gap ("Farfetch'd" -> "farfetchd", "Mr. Mime" -> "mr mime"). */
const JOINING_PUNCTUATION = /['’‘`´.:]/g;
const SEPARATORS = /[^\p{L}\p{N}]+/gu;

/**
 * Normalizes names and queries for search. Shared by the pipeline (to build `name_norm`)
 * and the query layer, so both sides always agree.
 *
 * 1. NFD and strip only Latin combining marks (U+0300–036F) — keeps Japanese dakuten
 *    (U+3099) and does not break Hangul, which NFKC recomposes next.
 * 2. NFKC (full-width -> ASCII, recomposition), then lowercase.
 * 3. Hiragana -> katakana, so either script finds the same Japanese name.
 * 4. ♀/♂ -> " f"/" m"; apostrophes/periods dropped; other separators -> single space.
 */
export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(HIRAGANA, (char) => String.fromCharCode(char.charCodeAt(0) + KATAKANA_OFFSET))
    .replaceAll('♀', ' f ')
    .replaceAll('♂', ' m ')
    .replace(JOINING_PUNCTUATION, '')
    .replace(SEPARATORS, ' ')
    .trim();
}

/** Smallest string greater than every string that starts with `prefix` (for range scans). */
export function prefixUpperBound(prefix: string): string {
  const codePoints = Array.from(prefix);
  const last = codePoints.pop();
  if (last === undefined) return '\u{10FFFF}';
  return codePoints.join('') + String.fromCodePoint((last.codePointAt(0) ?? 0) + 1);
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** True when the text contains CJK characters (short CJK names need substring search). */
export function containsCjk(text: string): boolean {
  return CJK.test(text);
}
