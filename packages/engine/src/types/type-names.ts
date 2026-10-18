import type { Generation } from '../generations';

/** The 18 battle types, using PokeAPI identifiers. */
export const TYPE_NAMES = [
  'normal',
  'fighting',
  'flying',
  'poison',
  'ground',
  'rock',
  'bug',
  'ghost',
  'steel',
  'fire',
  'water',
  'grass',
  'electric',
  'psychic',
  'ice',
  'dragon',
  'dark',
  'fairy',
] as const;

export type TypeName = (typeof TYPE_NAMES)[number];

const INTRODUCED_IN: Readonly<Partial<Record<TypeName, Generation>>> = {
  dark: 2,
  steel: 2,
  fairy: 6,
};

export function isTypeName(value: string): value is TypeName {
  return (TYPE_NAMES as readonly string[]).includes(value);
}

export function typeIntroducedIn(type: TypeName): Generation {
  return INTRODUCED_IN[type] ?? 1;
}

/** Types that exist in the given generation, in canonical order. */
export function typesInGeneration(gen: Generation): readonly TypeName[] {
  return TYPE_NAMES.filter((type) => typeIntroducedIn(type) <= gen);
}
