import type { CsvRow } from './csv';
import { toIntRequired } from './values';

/** PokeAPI language identifier → BCP-47 code used across TheDex. */
export const LANGUAGE_CODES: Readonly<Record<string, string>> = {
  'ja-hrkt': 'ja-Hrkt',
  'ja-roma': 'ja-Latn',
  ja: 'ja',
  ko: 'ko',
  'zh-hant': 'zh-Hant',
  'zh-hans': 'zh-Hans',
  fr: 'fr',
  de: 'de',
  es: 'es',
  'es-419': 'es-419',
  it: 'it',
  en: 'en',
  cs: 'cs',
  'pt-br': 'pt-BR',
};

/** Maps PokeAPI numeric language ids to BCP-47 codes. */
export class LanguageMap {
  private readonly byId = new Map<number, string>();

  constructor(rows: readonly CsvRow[]) {
    for (const row of rows) {
      const identifier = row.identifier ?? '';
      const code = LANGUAGE_CODES[identifier];
      if (!code) throw new Error(`Unmapped PokeAPI language "${identifier}"`);
      this.byId.set(toIntRequired(row.id, 'languages.id'), code);
    }
  }

  /** BCP-47 code for a PokeAPI language id cell, or null when unknown/empty. */
  code(idCell: string | undefined): string | null {
    if (idCell === undefined || idCell === '') return null;
    return this.byId.get(Number(idCell)) ?? null;
  }
}
