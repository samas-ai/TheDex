import { describe, expect, it } from 'vitest';
import { gameLangChain } from './lang';

describe('gameLangChain', () => {
  it('always ends with en and adds script/region fallbacks', () => {
    expect(gameLangChain('en')).toEqual(['en']);
    expect(gameLangChain('pt-BR')).toEqual(['pt-BR', 'en']);
    expect(gameLangChain('ja')).toEqual(['ja', 'ja-Hrkt', 'en']);
    expect(gameLangChain('es-419')).toEqual(['es-419', 'es', 'en']);
    expect(gameLangChain('zh-Hant')).toEqual(['zh-Hant', 'zh-Hans', 'en']);
  });
});
