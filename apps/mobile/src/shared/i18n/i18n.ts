import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { UiLanguage } from '../settings/settings';
import { en, type Translations } from './locales/en';
import { ptBR } from './locales/pt-BR';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: Translations };
  }
}

/**
 * Initializes i18next once (UI strings only; game data comes from the DB, RNF05) with the
 * startup language. Switching languages is the caller's job, outside render.
 */
export function initI18n(language: UiLanguage) {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      resources: { en: { translation: en }, 'pt-BR': { translation: ptBR } },
      lng: language,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      // Resources are bundled, so translations are ready synchronously on first render.
      initAsync: false,
    });
  }
  return i18next;
}
