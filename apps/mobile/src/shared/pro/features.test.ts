import { describe, expect, it } from 'vitest';
import {
  FEATURE_KEYS,
  FEATURES,
  FREE_TEAM_LIMIT,
  isFeatureEnabled,
  remainingTeams,
  unlockedTheme,
} from './features';

describe('feature registry (RNF08)', () => {
  it('unlocks every feature for PRO and gates the PRO ones for free users', () => {
    expect(FEATURE_KEYS).toEqual([
      'ads.removed',
      'team.unlimited',
      'checklist.shiny',
      'pokedex.combinedFilters',
      'theme.amoled',
    ]);
    for (const key of FEATURE_KEYS) {
      expect(isFeatureEnabled(key, 'pro')).toBe(true);
      expect(isFeatureEnabled(key, 'free')).toBe(FEATURES[key].plan === 'free');
    }
  });

  it('counts the teams left on the free plan', () => {
    expect(remainingTeams(0, false)).toBe(FREE_TEAM_LIMIT);
    expect(remainingTeams(FREE_TEAM_LIMIT - 1, false)).toBe(1);
    expect(remainingTeams(FREE_TEAM_LIMIT + 2, false)).toBe(0);
    expect(remainingTeams(50, true)).toBe(Number.POSITIVE_INFINITY);
  });

  it('falls back from AMOLED to dark while it is locked', () => {
    expect(unlockedTheme('amoled', false)).toBe('dark');
    expect(unlockedTheme('amoled', true)).toBe('amoled');
    expect(unlockedTheme('light', false)).toBe('light');
    expect(unlockedTheme('system', false)).toBe('system');
  });
});
