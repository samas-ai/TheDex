import {
  assertGeneration,
  chartMultiplier,
  defensiveMultipliers,
  effectiveness,
  isTypeName,
  typesInGeneration,
  type CombinedMultiplier,
  type TypeName,
} from '@thedex/engine';

/** Display order of multiplier groups, strongest first. */
export const MULTIPLIER_ORDER: readonly CombinedMultiplier[] = [4, 2, 1, 0.5, 0.25, 0];

export interface MatchupGroup {
  readonly multiplier: CombinedMultiplier;
  readonly types: readonly TypeName[];
}

function group(multipliers: Partial<Record<TypeName, CombinedMultiplier>>): MatchupGroup[] {
  return MULTIPLIER_ORDER.map((multiplier) => ({
    multiplier,
    types: (Object.entries(multipliers) as [TypeName, CombinedMultiplier][])
      .filter(([, value]) => value === multiplier)
      .map(([type]) => type),
  })).filter((entry) => entry.types.length > 0);
}

/**
 * Attacking types grouped by the damage multiplier they deal to this typing in `gen`
 * (RF02.3, RF07.1 defense). Unknown identifiers are ignored.
 */
export function defensiveGroups(types: readonly string[], generationId: number): MatchupGroup[] {
  const gen = assertGeneration(generationId);
  const defending = types.filter(isTypeName);
  if (defending.length === 0) return [];
  return group(defensiveMultipliers(defending, gen));
}

/**
 * Single defending types grouped by the best multiplier any of the attacking types deals
 * (RF07.1 offense: the coverage of a mono- or dual-type attacker's STAB moves).
 */
export function offensiveGroups(types: readonly string[], generationId: number): MatchupGroup[] {
  const gen = assertGeneration(generationId);
  const attacking = types.filter(isTypeName);
  if (attacking.length === 0) return [];
  const best: Partial<Record<TypeName, CombinedMultiplier>> = {};
  for (const defending of typesInGeneration(gen)) {
    best[defending] = Math.max(
      ...attacking.map((type) => effectiveness(type, [defending], gen)),
    ) as CombinedMultiplier;
  }
  return group(best);
}

/** `×4`, `×2`, `×1`, `×½`, `×¼`, `×0`. */
export function multiplierLabel(multiplier: number): string {
  if (multiplier === 0.5) return '×½';
  if (multiplier === 0.25) return '×¼';
  return `×${multiplier}`;
}

export interface TypeChart {
  /** Types of the generation, in PokeAPI order: rows attack, columns defend. */
  readonly types: readonly TypeName[];
  /** `cells[attacking][defending]` single-type multipliers. */
  readonly cells: readonly (readonly number[])[];
}

/** The generation's full type chart (RF07.1), from the engine. */
export function typeChart(generationId: number): TypeChart {
  const gen = assertGeneration(generationId);
  const types = typesInGeneration(gen);
  return {
    types,
    cells: types.map((attacking) =>
      types.map((defending) => chartMultiplier(attacking, defending, gen)),
    ),
  };
}

/** Type filter: at most two types combined; a third replaces the oldest. */
export function toggleTypePair<T>(selected: readonly T[], type: T): T[] {
  if (selected.includes(type)) return selected.filter((item) => item !== type);
  return [...selected, type].slice(-2);
}
