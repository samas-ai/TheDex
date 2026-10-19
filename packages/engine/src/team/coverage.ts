import type { Generation } from '../generations';
import { applyDefensiveAbility } from '../types/abilities';
import { effectiveness, type CombinedMultiplier } from '../types/effectiveness';
import { typesInGeneration, type TypeName } from '../types/type-names';

/** A team member as seen by the coverage analysis (RF08.3). */
export interface CoverageMember {
  /** Its 1 or 2 types in the team's generation. */
  readonly types: readonly TypeName[];
  /** PokeAPI ability identifier (type immunities such as Levitate count defensively). */
  readonly ability?: string | null;
  /** Types of its damaging moves (status moves excluded). */
  readonly moveTypes?: readonly TypeName[];
}

/** Defensive alert: `critical` = 3+ members weak; `warning` = 2 weak and nobody resists. */
export type CoverageSeverity = 'critical' | 'warning';

export interface DefenseRow {
  readonly attacking: TypeName;
  /** Multiplier each member takes, in team order. */
  readonly multipliers: readonly CombinedMultiplier[];
  readonly weak: number;
  readonly resist: number;
  readonly immune: number;
  readonly severity: CoverageSeverity | null;
}

export interface OffenseRow {
  readonly defending: TypeName;
  /** Best multiplier the team's damaging moves deal to this type; null without such moves. */
  readonly best: CombinedMultiplier | null;
  /** Members with a super-effective move against it. */
  readonly superEffective: number;
}

/** Defensive matrix (RF08.3): every attacking type of `gen` against every member. */
export function teamDefense(members: readonly CoverageMember[], gen: Generation): DefenseRow[] {
  return typesInGeneration(gen).map((attacking) => {
    const multipliers = members.map((member) =>
      applyDefensiveAbility(
        effectiveness(attacking, member.types, gen),
        attacking,
        member.ability,
        gen,
      ),
    );
    const weak = multipliers.filter((m) => m > 1).length;
    const resist = multipliers.filter((m) => m > 0 && m < 1).length;
    const immune = multipliers.filter((m) => m === 0).length;
    const severity: CoverageSeverity | null =
      weak >= 3 ? 'critical' : weak === 2 && resist + immune === 0 ? 'warning' : null;
    return { attacking, multipliers, weak, resist, immune, severity };
  });
}

/**
 * Offensive coverage (RF08.3): for every type of `gen`, the best multiplier the team's damaging
 * moves deal to a Pokémon of that single type, and how many members hit it super-effectively.
 * Moves with special effectiveness (Freeze-Dry, Flying Press…) count as their type.
 */
export function teamOffense(members: readonly CoverageMember[], gen: Generation): OffenseRow[] {
  return typesInGeneration(gen).map((defending) => {
    let best: CombinedMultiplier | null = null;
    let superEffective = 0;
    for (const member of members) {
      let memberBest: CombinedMultiplier | null = null;
      for (const moveType of new Set(member.moveTypes ?? [])) {
        const multiplier = effectiveness(moveType, [defending], gen);
        if (memberBest === null || multiplier > memberBest) memberBest = multiplier;
      }
      if (memberBest === null) continue;
      if (best === null || memberBest > best) best = memberBest;
      if (memberBest > 1) superEffective++;
    }
    return { defending, best, superEffective };
  });
}
