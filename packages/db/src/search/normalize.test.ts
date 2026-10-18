import { describe, expect, it } from 'vitest';
import { containsCjk, normalizeSearchText, prefixUpperBound } from './normalize';

describe('normalizeSearchText', () => {
  it.each([
    ['Charizard', 'charizard'],
    ['Mr. Mime', 'mr mime'],
    ['mr mime', 'mr mime'],
    ["Farfetch'd", 'farfetchd'],
    ['Farfetch’d', 'farfetchd'],
    ['Flabébé', 'flabebe'],
    ['Pokémon', 'pokemon'],
    ['Nidoran♀', 'nidoran f'],
    ['Nidoran♂', 'nidoran m'],
    ['Ho-Oh', 'ho oh'],
    ['Type: Null', 'type null'],
    ['Porygon-Z', 'porygon z'],
    ['  Mime   Jr.  ', 'mime jr'],
    ['ＰＩＫＡ', 'pika'],
    ['ぴかちゅう', 'ピカチュウ'],
    ['ピカチュウ', 'ピカチュウ'],
    ['ガブリアス', 'ガブリアス'],
    ['피카츄', '피카츄'],
    ['皮卡丘', '皮卡丘'],
    ['Água', 'agua'],
    ['Elétrico', 'eletrico'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected);
  });

  it('keeps Japanese voiced marks (does not strip U+3099)', () => {
    expect(normalizeSearchText('ガ')).not.toBe(normalizeSearchText('カ'));
  });
});

describe('prefixUpperBound', () => {
  it('returns the smallest string after every string with the prefix', () => {
    expect(prefixUpperBound('char')).toBe('chas');
    expect(prefixUpperBound('ピ')).toBe('フ'); // U+30D4 -> U+30D5
    expect('charizard' < prefixUpperBound('char')).toBe(true);
    expect('chas' < prefixUpperBound('char')).toBe(false);
    expect(prefixUpperBound('')).toBe('\u{10FFFF}');
  });
});

describe('containsCjk', () => {
  it('detects CJK scripts', () => {
    expect(containsCjk('ピカ')).toBe(true);
    expect(containsCjk('피카')).toBe(true);
    expect(containsCjk('皮卡')).toBe(true);
    expect(containsCjk('pika')).toBe(false);
  });
});
