/**
 * Game-data language fallbacks (RNF05). The chain is tried in order by every i18n lookup and
 * always ends with `en` (the only language PokeAPI covers completely).
 */
const FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  ja: ['ja-Hrkt'],
  'ja-Hrkt': ['ja'],
  'ja-Latn': ['ja-Hrkt'],
  'zh-Hans': ['zh-Hant'],
  'zh-Hant': ['zh-Hans'],
  'es-419': ['es'],
  es: ['es-419'],
};

/** `langChain` for a primary game-data language, e.g. `es-419` → `['es-419', 'es', 'en']`. */
export function gameLangChain(primary: string): string[] {
  const chain = [primary, ...(FALLBACKS[primary] ?? []), 'en'];
  return [...new Set(chain)];
}
