import { describe, expect, it } from 'vitest';
import {
  capitalize,
  dexNumber,
  formatHeight,
  formatPercent,
  formatDateTime,
  formatPrice,
  formatWeight,
  genderRatio,
  sellPrice,
} from './format';

describe('format', () => {
  it('capitalizes and pads dex numbers', () => {
    expect(capitalize('medium slow')).toBe('Medium slow');
    expect(capitalize('')).toBe('');
    expect(dexNumber(25)).toBe('#0025');
    expect(dexNumber(1025)).toBe('#1025');
  });

  it('converts PokeAPI units (decimetres, hectograms)', () => {
    expect(formatHeight(4)).toEqual({ meters: '0.4', feet: 1, inches: 4 });
    expect(formatHeight(17)).toEqual({ meters: '1.7', feet: 5, inches: 7 });
    expect(formatWeight(60)).toEqual({ kilograms: '6.0', pounds: '13.2' });
  });

  it('computes gender ratios from eighths', () => {
    expect(genderRatio(-1)).toBeNull();
    expect(genderRatio(0)).toEqual({ female: 0, male: 100 });
    expect(genderRatio(1)).toEqual({ female: 12.5, male: 87.5 });
    expect(formatPercent(12.5)).toBe('12.5');
    expect(formatPercent(50)).toBe('50');
  });
});

describe('prices (RF05.2)', () => {
  it('sells at half the buy price; free items cannot be bought or sold', () => {
    expect(sellPrice(200)).toBe(100);
    expect(sellPrice(75)).toBe(37);
    expect(sellPrice(0)).toBeNull();
    expect(sellPrice(null)).toBeNull();
  });

  it('formats Pokédollars with the locale grouping', () => {
    expect(formatPrice(40000, 'en')).toBe('₽40,000');
    expect(formatPrice(40000, 'pt-BR')).toBe('₽40.000');
  });

  it('formats dates and times in the UI locale', () => {
    const date = new Date(2026, 9, 19, 8, 52).getTime();
    expect(formatDateTime(date, 'en')).toMatch(/Oct 19, 2026.*08:52/);
    expect(formatDateTime(date, 'pt-BR')).toMatch(/19 de out\.? de 2026.*08:52/);
  });
});
