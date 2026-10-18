import type { HexColor } from './color';

/**
 * The 18 battle types, using PokeAPI identifiers, in PokeAPI id order (id = index + 1).
 * Kept here (not imported from @thedex/engine) so the tokens package has zero dependencies.
 */
export const TYPE_IDENTIFIERS = [
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

export type TypeIdentifier = (typeof TYPE_IDENTIFIERS)[number];

/** Base color of each type (RNF03): badges, accents, tinted backgrounds. */
export const TYPE_COLORS: Readonly<Record<TypeIdentifier, HexColor>> = {
  normal: '#A8A77A',
  fighting: '#C22E28',
  flying: '#A98FF3',
  poison: '#A33EA1',
  ground: '#E2BF65',
  rock: '#B6A136',
  bug: '#A6B91A',
  ghost: '#735797',
  steel: '#B7B7CE',
  fire: '#EE8130',
  water: '#6390F0',
  grass: '#7AC74C',
  electric: '#F7D02C',
  psychic: '#F95587',
  ice: '#96D9D6',
  dragon: '#6F35FC',
  dark: '#705746',
  fairy: '#D685AD',
};

export function isTypeIdentifier(value: string): value is TypeIdentifier {
  return (TYPE_IDENTIFIERS as readonly string[]).includes(value);
}

/**
 * Resolves a type from its PokeAPI identifier or numeric id (1–18). Anything else
 * (`unknown`, `shadow`, `stellar`, null) returns null so callers fall back to the theme accent.
 */
export function resolveTypeIdentifier(
  type: string | number | null | undefined,
): TypeIdentifier | null {
  if (typeof type === 'number') return TYPE_IDENTIFIERS[type - 1] ?? null;
  return type && isTypeIdentifier(type) ? type : null;
}
