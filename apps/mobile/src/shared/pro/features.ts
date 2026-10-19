import type { ThemePreference } from '@thedex/ui-tokens';

/** The user's plan (RNF08). Only the entitlement provider knows it; components ask for features. */
export type Plan = 'free' | 'pro';

interface FeatureDefinition {
  /** Lowest plan with the feature: moving one to `free` (a promotion) is a one-line change. */
  readonly plan: Plan;
}

export const FEATURE_KEYS = [
  'ads.removed',
  'team.unlimited',
  'checklist.shiny',
  'pokedex.combinedFilters',
  'theme.amoled',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

/**
 * Feature registry (RNF08). Components call `useFeature(key)`, `useRequirePro()` or
 * `<ProGate feature>` — never the plan itself — so what PRO unlocks is decided here only.
 */
export const FEATURES: Readonly<Record<FeatureKey, FeatureDefinition>> = {
  /** Hides the `<AdSlot>` banners. */
  'ads.removed': { plan: 'pro' },
  /** More than FREE_TEAM_LIMIT teams (RF08.1). */
  'team.unlimited': { plan: 'pro' },
  /** Shiny marks and the shiny-hunting filter of the checklist (RF09). */
  'checklist.shiny': { plan: 'pro' },
  /** Pokédex filters from more than one group at a time, e.g. type + generation (RF01.3). */
  'pokedex.combinedFilters': { plan: 'pro' },
  /** AMOLED black theme (RNF04). */
  'theme.amoled': { plan: 'pro' },
};

export function isFeatureEnabled(feature: FeatureKey, plan: Plan): boolean {
  return FEATURES[feature].plan === 'free' || plan === 'pro';
}

/** Teams the free plan keeps (RF08.1). Existing teams above it stay editable, never locked. */
export const FREE_TEAM_LIMIT = 3;

/** How many more teams can be created or imported. */
export function remainingTeams(existing: number, unlimited: boolean): number {
  return unlimited ? Number.POSITIVE_INFINITY : Math.max(0, FREE_TEAM_LIMIT - existing);
}

/** The theme actually applied: a stored AMOLED choice falls back to dark while it is locked. */
export function unlockedTheme(preference: ThemePreference, amoled: boolean): ThemePreference {
  return preference === 'amoled' && !amoled ? 'dark' : preference;
}
