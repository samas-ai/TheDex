import type { Generation } from '../generations';
import type { TypeName } from './type-names';

/** Damage multiplier of a single attacking type against a single defending type. */
export type Multiplier = 0 | 0.5 | 1 | 2;

interface Matchups {
  readonly superEffective: readonly TypeName[];
  readonly notVeryEffective: readonly TypeName[];
  readonly noEffect: readonly TypeName[];
}

/** Generation 6+ chart (unchanged through Gen 9). */
const MODERN: Readonly<Record<TypeName, Matchups>> = {
  normal: { superEffective: [], notVeryEffective: ['rock', 'steel'], noEffect: ['ghost'] },
  fighting: {
    superEffective: ['normal', 'ice', 'rock', 'dark', 'steel'],
    notVeryEffective: ['poison', 'flying', 'psychic', 'bug', 'fairy'],
    noEffect: ['ghost'],
  },
  flying: {
    superEffective: ['grass', 'fighting', 'bug'],
    notVeryEffective: ['electric', 'rock', 'steel'],
    noEffect: [],
  },
  poison: {
    superEffective: ['grass', 'fairy'],
    notVeryEffective: ['poison', 'ground', 'rock', 'ghost'],
    noEffect: ['steel'],
  },
  ground: {
    superEffective: ['fire', 'electric', 'poison', 'rock', 'steel'],
    notVeryEffective: ['grass', 'bug'],
    noEffect: ['flying'],
  },
  rock: {
    superEffective: ['fire', 'ice', 'flying', 'bug'],
    notVeryEffective: ['fighting', 'ground', 'steel'],
    noEffect: [],
  },
  bug: {
    superEffective: ['grass', 'psychic', 'dark'],
    notVeryEffective: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'],
    noEffect: [],
  },
  ghost: { superEffective: ['psychic', 'ghost'], notVeryEffective: ['dark'], noEffect: ['normal'] },
  steel: {
    superEffective: ['ice', 'rock', 'fairy'],
    notVeryEffective: ['fire', 'water', 'electric', 'steel'],
    noEffect: [],
  },
  fire: {
    superEffective: ['grass', 'ice', 'bug', 'steel'],
    notVeryEffective: ['fire', 'water', 'rock', 'dragon'],
    noEffect: [],
  },
  water: {
    superEffective: ['fire', 'ground', 'rock'],
    notVeryEffective: ['water', 'grass', 'dragon'],
    noEffect: [],
  },
  grass: {
    superEffective: ['water', 'ground', 'rock'],
    notVeryEffective: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'],
    noEffect: [],
  },
  electric: {
    superEffective: ['water', 'flying'],
    notVeryEffective: ['electric', 'grass', 'dragon'],
    noEffect: ['ground'],
  },
  psychic: {
    superEffective: ['fighting', 'poison'],
    notVeryEffective: ['psychic', 'steel'],
    noEffect: ['dark'],
  },
  ice: {
    superEffective: ['grass', 'ground', 'flying', 'dragon'],
    notVeryEffective: ['fire', 'water', 'ice', 'steel'],
    noEffect: [],
  },
  dragon: { superEffective: ['dragon'], notVeryEffective: ['steel'], noEffect: ['fairy'] },
  dark: {
    superEffective: ['psychic', 'ghost'],
    notVeryEffective: ['fighting', 'dark', 'fairy'],
    noEffect: [],
  },
  fairy: {
    superEffective: ['fighting', 'dragon', 'dark'],
    notVeryEffective: ['fire', 'poison', 'steel'],
    noEffect: [],
  },
};

interface Override {
  readonly attacking: TypeName;
  readonly defending: TypeName;
  readonly multiplier: Multiplier;
  /** Last generation in which this override applies (same semantics as PokeAPI `*_past`). */
  readonly untilGeneration: Generation;
}

/** Historical deviations from the modern chart. */
const OVERRIDES: readonly Override[] = [
  // Gen 2-5: Steel resisted Ghost and Dark.
  { attacking: 'ghost', defending: 'steel', multiplier: 0.5, untilGeneration: 5 },
  { attacking: 'dark', defending: 'steel', multiplier: 0.5, untilGeneration: 5 },
  // Gen 1 quirks.
  { attacking: 'bug', defending: 'poison', multiplier: 2, untilGeneration: 1 },
  { attacking: 'poison', defending: 'bug', multiplier: 2, untilGeneration: 1 },
  { attacking: 'ghost', defending: 'psychic', multiplier: 0, untilGeneration: 1 },
  { attacking: 'ice', defending: 'fire', multiplier: 1, untilGeneration: 1 },
];

function modernMultiplier(attacking: TypeName, defending: TypeName): Multiplier {
  const matchups = MODERN[attacking];
  if (matchups.noEffect.includes(defending)) return 0;
  if (matchups.superEffective.includes(defending)) return 2;
  if (matchups.notVeryEffective.includes(defending)) return 0.5;
  return 1;
}

/**
 * Multiplier for one attacking type against one defending type in `gen`.
 * Does not validate that the types exist in `gen` — see `effectiveness` for that.
 */
export function chartMultiplier(
  attacking: TypeName,
  defending: TypeName,
  gen: Generation,
): Multiplier {
  const override = OVERRIDES.find(
    (o) => o.attacking === attacking && o.defending === defending && gen <= o.untilGeneration,
  );
  return override ? override.multiplier : modernMultiplier(attacking, defending);
}
