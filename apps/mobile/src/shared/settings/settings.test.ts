import { describe, expect, it } from 'vitest';
import { decodeSettings, defaultSettings, matchUiLanguage, resolveUiLanguage } from './settings';

describe('settings', () => {
  it('derives first-launch defaults from the device language', () => {
    expect(defaultSettings('pt-BR')).toEqual({
      uiLang: 'system',
      gameLangs: ['pt-BR', 'en'],
      theme: 'system',
      spriteStyle: 'official',
      gameId: null,
      checklistKind: 'national',
    });
    expect(defaultSettings('ja-JP').gameLangs).toEqual(['en']);
    expect(defaultSettings(null).gameLangs).toEqual(['en']);
  });

  it('resolves the UI language', () => {
    expect(matchUiLanguage('pt-PT')).toBe('pt-BR');
    expect(matchUiLanguage('de-DE')).toBe('en');
    expect(resolveUiLanguage('system', 'pt-BR')).toBe('pt-BR');
    expect(resolveUiLanguage('en', 'pt-BR')).toBe('en');
  });

  it('keeps valid stored values and replaces invalid ones with defaults', () => {
    expect(
      decodeSettings(
        {
          ui_lang: 'pt-BR',
          game_langs: ['ja-Hrkt', 'ja'],
          theme: 'amoled',
          sprite_style: 'home',
          game_id: 7,
          checklist_kind: 'game',
        },
        'en-US',
      ),
    ).toEqual({
      uiLang: 'pt-BR',
      gameLangs: ['ja-Hrkt', 'ja', 'en'],
      theme: 'amoled',
      spriteStyle: 'home',
      gameId: 7,
      checklistKind: 'game',
    });
    expect(
      decodeSettings(
        {
          ui_lang: 'fr',
          game_langs: [],
          theme: 'sepia',
          sprite_style: 'ascii',
          game_id: '7',
          checklist_kind: 'box',
        },
        'en-US',
      ),
    ).toEqual(defaultSettings('en-US'));
  });
});
