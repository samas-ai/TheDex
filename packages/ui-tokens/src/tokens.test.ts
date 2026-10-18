import { describe, expect, it } from 'vitest';
import {
  ACCENT_TEXT_CONTRAST,
  BLACK,
  contrastRatio,
  DAMAGE_CLASS_COLORS,
  EFFECTIVENESS_COLORS,
  ensureContrast,
  isHexColor,
  isThemePreference,
  mix,
  onColor,
  resolveThemeName,
  resolveTypeIdentifier,
  statBarColor,
  STAT_BAR_COLORS,
  THEME_NAMES,
  THEMES,
  TYPE_COLORS,
  TYPE_IDENTIFIERS,
  typeAccent,
  WHITE,
  withAlpha,
} from './index';

describe('color math', () => {
  it('mixes, clamps and formats hex colors', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#102030', '#FFFFFF', -1)).toBe('#102030');
    expect(mix('#102030', '#FFFFFF', 2)).toBe('#FFFFFF');
    expect(withAlpha('#FF0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(() => mix('#FFF' as never, '#000000', 0.5)).toThrow(RangeError);
  });

  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
    expect(onColor('#F7D02C')).toBe(BLACK);
    expect(onColor('#6F35FC')).toBe(WHITE);
  });

  it('raises contrast until the requested ratio (or the extreme) is reached', () => {
    const text = ensureContrast('#F7D02C', '#FFFFFF', 4.5);
    expect(contrastRatio(text, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(ensureContrast('#777777', '#FFFFFF', 30)).toBe(BLACK);
  });
});

describe('type palette (RNF03)', () => {
  it('defines a valid color for each of the 18 types in PokeAPI id order', () => {
    expect(TYPE_IDENTIFIERS).toHaveLength(18);
    expect(Object.keys(TYPE_COLORS).sort()).toEqual([...TYPE_IDENTIFIERS].sort());
    for (const color of Object.values(TYPE_COLORS)) expect(isHexColor(color)).toBe(true);
    expect(TYPE_IDENTIFIERS[9]).toBe('fire'); // PokeAPI type id 10
  });

  it('resolves identifiers and PokeAPI ids, rejecting non-battle types', () => {
    expect(resolveTypeIdentifier(10)).toBe('fire');
    expect(resolveTypeIdentifier('fairy')).toBe('fairy');
    expect(resolveTypeIdentifier(19)).toBeNull();
    expect(resolveTypeIdentifier(0)).toBeNull();
    expect(resolveTypeIdentifier('shadow')).toBeNull();
    expect(resolveTypeIdentifier(null)).toBeNull();
  });

  it('derives readable accents for every type in every theme', () => {
    for (const themeName of THEME_NAMES) {
      const theme = THEMES[themeName];
      for (const type of TYPE_IDENTIFIERS) {
        const accent = typeAccent(type, theme);
        expect(accent.base).toBe(TYPE_COLORS[type]);
        expect(contrastRatio(accent.onBase, accent.base)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(accent.text, theme.colors.background)).toBeGreaterThanOrEqual(
          ACCENT_TEXT_CONTRAST,
        );
      }
    }
  });

  it('memoizes accents and falls back to the theme primary', () => {
    expect(typeAccent('fire', THEMES.dark)).toBe(typeAccent(10, THEMES.dark));
    expect(typeAccent(null, THEMES.light).base).toBe(THEMES.light.colors.primary);
    expect(typeAccent('stellar', THEMES.amoled).base).toBe(THEMES.amoled.colors.primary);
  });
});

describe('themes (RNF04)', () => {
  it('has light, dark and a pure-black AMOLED theme', () => {
    expect(THEME_NAMES).toEqual(['light', 'dark', 'amoled']);
    expect(THEMES.amoled.colors.background).toBe('#000000');
    expect(THEMES.light.isDark).toBe(false);
    expect(THEMES.amoled.isDark).toBe(true);
  });

  it('keeps text readable on every surface', () => {
    for (const name of THEME_NAMES) {
      const { colors } = THEMES[name];
      for (const surface of [colors.background, colors.surface, colors.surfaceVariant]) {
        expect(contrastRatio(colors.text, surface)).toBeGreaterThanOrEqual(7);
        expect(contrastRatio(colors.textMuted, surface)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
      for (const color of Object.values(colors)) expect(isHexColor(color)).toBe(true);
    }
  });

  it('resolves the system preference', () => {
    expect(resolveThemeName('system', 'dark')).toBe('dark');
    expect(resolveThemeName('system', null)).toBe('light');
    expect(resolveThemeName('amoled', 'light')).toBe('amoled');
    expect(isThemePreference('amoled')).toBe(true);
    expect(isThemePreference('sepia')).toBe(false);
  });
});

describe('semantic palettes', () => {
  it('colors multipliers, damage classes and stat bars', () => {
    expect(Object.keys(EFFECTIVENESS_COLORS)).toHaveLength(6);
    expect(Object.keys(DAMAGE_CLASS_COLORS)).toEqual(['physical', 'special', 'status']);
    expect(statBarColor(10)).toBe(STAT_BAR_COLORS[0]);
    expect(statBarColor(100)).toBe(STAT_BAR_COLORS[3]);
    expect(statBarColor(255)).toBe(STAT_BAR_COLORS[5]);
  });
});
