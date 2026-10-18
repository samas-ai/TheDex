import type { HexColor } from './color';

/** Concrete palettes (RNF04). `system` is resolved by the app to light or dark. */
export const THEME_NAMES = ['light', 'dark', 'amoled'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

/** What the user picks in Settings (`settings.theme`). */
export const THEME_PREFERENCES = ['system', 'light', 'dark', 'amoled'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export interface ThemeColors {
  /** Screen background. AMOLED is pure black (#000000). */
  readonly background: HexColor;
  /** Cards, list rows, sheets. */
  readonly surface: HexColor;
  /** Inputs, chips, stat-bar tracks, pressed rows. */
  readonly surfaceVariant: HexColor;
  readonly border: HexColor;
  readonly text: HexColor;
  readonly textMuted: HexColor;
  /** App accent when no type is in focus (Pokédex red). */
  readonly primary: HexColor;
  readonly onPrimary: HexColor;
  readonly danger: HexColor;
  readonly success: HexColor;
  readonly warning: HexColor;
  /** Modal scrim base color (apply with `withAlpha`). */
  readonly scrim: HexColor;
}

export interface Theme {
  readonly name: ThemeName;
  readonly isDark: boolean;
  readonly colors: ThemeColors;
}

export const THEMES: Readonly<Record<ThemeName, Theme>> = {
  light: {
    name: 'light',
    isDark: false,
    colors: {
      background: '#F5F6F8',
      surface: '#FFFFFF',
      surfaceVariant: '#ECEEF2',
      border: '#D9DCE2',
      text: '#16171A',
      textMuted: '#585C66',
      primary: '#C8102E',
      onPrimary: '#FFFFFF',
      danger: '#B3261E',
      success: '#1E7A3A',
      warning: '#8A5A00',
      scrim: '#000000',
    },
  },
  dark: {
    name: 'dark',
    isDark: true,
    colors: {
      background: '#121316',
      surface: '#1C1D21',
      surfaceVariant: '#2A2C31',
      border: '#383A40',
      text: '#F2F3F5',
      textMuted: '#A7AAB2',
      primary: '#FF5A65',
      onPrimary: '#000000',
      danger: '#FF8A80',
      success: '#6FD08C',
      warning: '#F5C060',
      scrim: '#000000',
    },
  },
  amoled: {
    name: 'amoled',
    isDark: true,
    colors: {
      background: '#000000',
      surface: '#0D0D0F',
      surfaceVariant: '#1B1C1F',
      border: '#2A2B2F',
      text: '#F2F3F5',
      textMuted: '#9EA1A9',
      primary: '#FF5A65',
      onPrimary: '#000000',
      danger: '#FF8A80',
      success: '#6FD08C',
      warning: '#F5C060',
      scrim: '#000000',
    },
  },
};

/** Resolves the user preference against the OS color scheme. */
export function resolveThemeName(
  preference: ThemePreference,
  systemScheme: 'light' | 'dark' | null | undefined,
): ThemeName {
  if (preference !== 'system') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export const SPACING = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const RADII = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const FONT_SIZES = {
  caption: 12,
  small: 13,
  body: 15,
  title: 17,
  headline: 22,
  display: 28,
} as const;

export const FONT_WEIGHTS = { regular: '400', medium: '500', bold: '700' } as const;
