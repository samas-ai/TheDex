import { describe, expect, it } from 'vitest';
import {
  capitalize,
  dexNumber,
  formatHeight,
  formatPercent,
  formatWeight,
  genderRatio,
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
