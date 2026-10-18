import type { Generation } from '../generations';
import { chartMultiplier } from './chart';
import { typeIntroducedIn, typesInGeneration, type TypeName } from './type-names';

/** Combined multiplier against a mono- or dual-typed defender. */
export type CombinedMultiplier = 0 | 0.25 | 0.5 | 1 | 2 | 4;

function assertTypesExist(types: readonly TypeName[], gen: Generation): void {
  for (const type of types) {
    if (typeIntroducedIn(type) > gen) {
      throw new RangeError(`Type "${type}" does not exist in generation ${gen}`);
    }
  }
}

function assertDefending(defending: readonly TypeName[]): void {
  if (defending.length < 1 || defending.length > 2) {
    throw new RangeError(`Expected 1 or 2 defending types, got ${defending.length}`);
  }
  if (defending.length === 2 && defending[0] === defending[1]) {
    throw new RangeError(`Duplicate defending type "${defending[0]}"`);
  }
}

/** Effectiveness of one attacking type against a mono- or dual-typed defender. */
export function effectiveness(
  attacking: TypeName,
  defending: readonly TypeName[],
  gen: Generation,
): CombinedMultiplier {
  assertDefending(defending);
  assertTypesExist([attacking, ...defending], gen);
  return defending.reduce<number>(
    (acc, type) => acc * chartMultiplier(attacking, type, gen),
    1,
  ) as CombinedMultiplier;
}

/** Multiplier taken from every attacking type that exists in `gen` (RF02.3 / RF07.1). */
export function defensiveMultipliers(
  defending: readonly TypeName[],
  gen: Generation,
): Partial<Record<TypeName, CombinedMultiplier>> {
  const result: Partial<Record<TypeName, CombinedMultiplier>> = {};
  for (const attacking of typesInGeneration(gen)) {
    result[attacking] = effectiveness(attacking, defending, gen);
  }
  return result;
}

/** Multiplier dealt by `attacking` to every single defending type that exists in `gen`. */
export function offensiveMultipliers(
  attacking: TypeName,
  gen: Generation,
): Partial<Record<TypeName, CombinedMultiplier>> {
  const result: Partial<Record<TypeName, CombinedMultiplier>> = {};
  for (const defending of typesInGeneration(gen)) {
    result[defending] = effectiveness(attacking, [defending], gen);
  }
  return result;
}

const PHYSICAL_BEFORE_GEN4: ReadonlySet<TypeName> = new Set([
  'normal',
  'fighting',
  'flying',
  'poison',
  'ground',
  'rock',
  'bug',
  'ghost',
  'steel',
]);

/**
 * Damage class of a damaging move in Gens 1-3, where it was determined by type
 * (the physical/special split arrived in Gen 4). Fairy did not exist then.
 */
export function legacyDamageClass(type: TypeName): 'physical' | 'special' {
  if (type === 'fairy') throw new RangeError('Fairy type did not exist before generation 6');
  return PHYSICAL_BEFORE_GEN4.has(type) ? 'physical' : 'special';
}
