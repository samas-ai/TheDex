import type { Generation } from '../generations';
import type { CombinedMultiplier } from './effectiveness';
import type { TypeName } from './type-names';

/** Abilities that make the holder immune to one attacking type, from the generation it applies. */
const TYPE_IMMUNITY_ABILITIES: Readonly<
  Record<string, { readonly type: TypeName; readonly since: Generation }>
> = {
  levitate: { type: 'ground', since: 3 },
  'flash-fire': { type: 'fire', since: 3 },
  'water-absorb': { type: 'water', since: 3 },
  'volt-absorb': { type: 'electric', since: 3 },
  'motor-drive': { type: 'electric', since: 4 },
  'dry-skin': { type: 'water', since: 4 },
  // Before Gen 5 these two only redirected moves.
  'lightning-rod': { type: 'electric', since: 5 },
  'storm-drain': { type: 'water', since: 5 },
  'sap-sipper': { type: 'grass', since: 5 },
  'earth-eater': { type: 'ground', since: 9 },
  'well-baked-body': { type: 'fire', since: 9 },
};

/** The attacking type an ability makes its holder immune to in `gen`, if any. */
export function abilityImmunity(ability: string, gen: Generation): TypeName | null {
  const immunity = TYPE_IMMUNITY_ABILITIES[ability];
  return immunity && gen >= immunity.since ? immunity.type : null;
}

/**
 * Type multiplier after the defender's ability (PokeAPI identifier): type immunities (Levitate,
 * Flash Fire, Volt Absorb…) and Wonder Guard (only super-effective hits land). Abilities that
 * scale damage (Thick Fat, Filter…) are not modeled.
 */
export function applyDefensiveAbility(
  multiplier: CombinedMultiplier,
  attacking: TypeName,
  ability: string | null | undefined,
  gen: Generation,
): CombinedMultiplier {
  if (!ability) return multiplier;
  if (abilityImmunity(ability, gen) === attacking) return 0;
  if (ability === 'wonder-guard' && gen >= 3 && multiplier < 2) return 0;
  return multiplier;
}
