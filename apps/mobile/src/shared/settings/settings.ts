import {
  gameLangChain,
  isSpriteStyle,
  type ChecklistKind,
  type SettingKey,
  type SpriteStyle,
} from '@thedex/db';
import { isThemePreference, type ThemePreference } from '@thedex/ui-tokens';

/** UI languages with a locale file (RNF05). `system` follows the device. */
export const UI_LANGUAGES = ['en', 'pt-BR'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];
export type UiLanguagePreference = 'system' | UiLanguage;

/** Game selected when the user never picked one (RF01.2). */
export const DEFAULT_GAME_IDENTIFIER = 'scarlet-violet';

/** Typed view of thedex-user.db `settings` (see SETTING_KEYS in @thedex/db). */
export interface AppSettings {
  readonly uiLang: UiLanguagePreference;
  /** Game-data language chain, most preferred first; always ends with `en`. */
  readonly gameLangs: readonly string[];
  readonly theme: ThemePreference;
  readonly spriteStyle: SpriteStyle;
  /** Curated game id, or null for DEFAULT_GAME_IDENTIFIER. */
  readonly gameId: number | null;
  /** Collection the checklist and the Pokédex capture filter use (RF09): National Dex or game. */
  readonly checklistKind: ChecklistKind;
}

/** Storage key of each setting. */
export const SETTING_KEY_OF: Readonly<Record<keyof AppSettings, SettingKey>> = {
  uiLang: 'ui_lang',
  gameLangs: 'game_langs',
  theme: 'theme',
  spriteStyle: 'sprite_style',
  gameId: 'game_id',
  checklistKind: 'checklist_kind',
};

/** Matches a device language tag (`pt-PT`, `en-US`…) to a UI language. */
export function matchUiLanguage(languageTag: string | null | undefined): UiLanguage {
  return languageTag?.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
}

export function resolveUiLanguage(
  preference: UiLanguagePreference,
  deviceLanguageTag: string | null | undefined,
): UiLanguage {
  return preference === 'system' ? matchUiLanguage(deviceLanguageTag) : preference;
}

/** First-launch defaults: game data follows the device language when TheDex has it. */
export function defaultSettings(deviceLanguageTag: string | null | undefined): AppSettings {
  return {
    uiLang: 'system',
    gameLangs: gameLangChain(matchUiLanguage(deviceLanguageTag)),
    theme: 'system',
    spriteStyle: 'official',
    gameId: null,
    checklistKind: 'national',
  };
}

function isUiLanguagePreference(value: unknown): value is UiLanguagePreference {
  return value === 'system' || (UI_LANGUAGES as readonly unknown[]).includes(value);
}

function isLangChain(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((lang) => typeof lang === 'string' && lang.length > 0)
  );
}

/**
 * Decodes raw stored settings (any JSON, possibly from an older or newer app version),
 * keeping valid values and falling back to defaults for the rest.
 */
export function decodeSettings(
  raw: Readonly<Record<string, unknown>>,
  deviceLanguageTag: string | null | undefined,
): AppSettings {
  const defaults = defaultSettings(deviceLanguageTag);
  const uiLang = raw[SETTING_KEY_OF.uiLang];
  const gameLangs = raw[SETTING_KEY_OF.gameLangs];
  const theme = raw[SETTING_KEY_OF.theme];
  const spriteStyle = raw[SETTING_KEY_OF.spriteStyle];
  const gameId = raw[SETTING_KEY_OF.gameId];
  const checklistKind = raw[SETTING_KEY_OF.checklistKind];
  return {
    uiLang: isUiLanguagePreference(uiLang) ? uiLang : defaults.uiLang,
    gameLangs: isLangChain(gameLangs)
      ? gameLangs.includes('en')
        ? gameLangs
        : [...gameLangs, 'en']
      : defaults.gameLangs,
    theme: isThemePreference(theme) ? theme : defaults.theme,
    spriteStyle: isSpriteStyle(spriteStyle) ? spriteStyle : defaults.spriteStyle,
    gameId: typeof gameId === 'number' && Number.isInteger(gameId) ? gameId : defaults.gameId,
    checklistKind:
      checklistKind === 'national' || checklistKind === 'game'
        ? checklistKind
        : defaults.checklistKind,
  };
}
