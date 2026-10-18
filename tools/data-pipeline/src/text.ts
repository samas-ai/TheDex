/**
 * Cleans in-game flavor text: a soft hyphen at a line break joins the word ("fore­\nlegs"),
 * a real hyphen at a line break is kept without the break ("self-\ndestruct"), other hard
 * breaks (\n, \f, \r) become spaces, and whitespace is collapsed.
 */
export function cleanFlavorText(text: string): string {
  return text
    .replace(/­[\n\f\r]+/g, '')
    .replace(/(\p{L})-[\n\f\r]+/gu, '$1-')
    .replace(/[\n\f\r\t]+/g, ' ')
    .replace(/­/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}
