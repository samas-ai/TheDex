import { ensureContrast, mix, onColor, type HexColor } from './color';
import type { Theme } from './themes';
import { resolveTypeIdentifier, TYPE_COLORS } from './types';

/** Accent palette derived from a type color for the current theme (RNF03). */
export interface TypeAccent {
  /** The raw type color (badges, stat bars, header band). */
  readonly base: HexColor;
  /** Text/icons drawn on `base` (≥ 4.5:1). */
  readonly onBase: HexColor;
  /** Subtle tinted background (screen header, selected tab). */
  readonly tint: HexColor;
  /** Stronger tint (pressed states, chips). */
  readonly tintStrong: HexColor;
  /** The accent as text on the theme background (≥ 4.5:1). */
  readonly text: HexColor;
  /** Hairlines and outlines in the accent hue. */
  readonly border: HexColor;
}

/** Minimum contrast for accent text on themed backgrounds (WCAG AA, normal text). */
export const ACCENT_TEXT_CONTRAST = 4.5;

function accentFrom(base: HexColor, theme: Theme): TypeAccent {
  const { background, surface } = theme.colors;
  const tintAmount = theme.isDark ? 0.82 : 0.86;
  return {
    base,
    onBase: onColor(base),
    tint: mix(base, background, tintAmount),
    tintStrong: mix(base, surface, theme.isDark ? 0.62 : 0.7),
    text: ensureContrast(base, background, ACCENT_TEXT_CONTRAST),
    border: mix(base, background, theme.isDark ? 0.45 : 0.35),
  };
}

const cache = new Map<string, TypeAccent>();

/**
 * Accent for a type (PokeAPI identifier or id 1–18) in a theme. Unknown/absent types fall
 * back to the theme's primary color. Pure and memoized.
 */
export function typeAccent(type: string | number | null | undefined, theme: Theme): TypeAccent {
  const identifier = resolveTypeIdentifier(type);
  const key = `${theme.name}:${identifier ?? 'primary'}`;
  let accent = cache.get(key);
  if (!accent) {
    accent = accentFrom(identifier ? TYPE_COLORS[identifier] : theme.colors.primary, theme);
    cache.set(key, accent);
  }
  return accent;
}

/** Damage multipliers shown in the type chart (RF02.3), keyed by the multiplier. */
export const EFFECTIVENESS_COLORS: Readonly<
  Record<'0' | '0.25' | '0.5' | '1' | '2' | '4', HexColor>
> = {
  '0': '#2D2F36',
  '0.25': '#2E7D32',
  '0.5': '#66BB6A',
  '1': '#9EA3AD',
  '2': '#F57C00',
  '4': '#C62828',
};

/** Move damage classes (physical / special / status). */
export const DAMAGE_CLASS_COLORS: Readonly<Record<'physical' | 'special' | 'status', HexColor>> = {
  physical: '#E2533B',
  special: '#4F7BD9',
  status: '#9A9DA5',
};

/** Base-stat bar color by value: < 50, < 80, < 100, < 120, < 150, ≥ 150. */
export const STAT_BAR_COLORS: readonly HexColor[] = [
  '#F34444',
  '#FF7F0F',
  '#FFDD57',
  '#A0E515',
  '#23CD5E',
  '#00C2B8',
];

export function statBarColor(value: number): HexColor {
  const thresholds = [50, 80, 100, 120, 150];
  const index = thresholds.findIndex((limit) => value < limit);
  return STAT_BAR_COLORS[index === -1 ? STAT_BAR_COLORS.length - 1 : index]!;
}
