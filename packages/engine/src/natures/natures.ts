/** Stats a nature can modify, using PokeAPI identifiers. */
export type NatureStat = 'attack' | 'defense' | 'special-attack' | 'special-defense' | 'speed';

/** Berry flavors, using PokeAPI identifiers. */
export type Flavor = 'spicy' | 'sour' | 'dry' | 'bitter' | 'sweet';

export interface Nature {
  /** Stat boosted by 10%, or null for neutral natures. */
  readonly increased: NatureStat | null;
  /** Stat lowered by 10%, or null for neutral natures. */
  readonly decreased: NatureStat | null;
}

export const NATURES = {
  hardy: { increased: null, decreased: null },
  lonely: { increased: 'attack', decreased: 'defense' },
  brave: { increased: 'attack', decreased: 'speed' },
  adamant: { increased: 'attack', decreased: 'special-attack' },
  naughty: { increased: 'attack', decreased: 'special-defense' },
  bold: { increased: 'defense', decreased: 'attack' },
  docile: { increased: null, decreased: null },
  relaxed: { increased: 'defense', decreased: 'speed' },
  impish: { increased: 'defense', decreased: 'special-attack' },
  lax: { increased: 'defense', decreased: 'special-defense' },
  timid: { increased: 'speed', decreased: 'attack' },
  hasty: { increased: 'speed', decreased: 'defense' },
  serious: { increased: null, decreased: null },
  jolly: { increased: 'speed', decreased: 'special-attack' },
  naive: { increased: 'speed', decreased: 'special-defense' },
  modest: { increased: 'special-attack', decreased: 'attack' },
  mild: { increased: 'special-attack', decreased: 'defense' },
  quiet: { increased: 'special-attack', decreased: 'speed' },
  bashful: { increased: null, decreased: null },
  rash: { increased: 'special-attack', decreased: 'special-defense' },
  calm: { increased: 'special-defense', decreased: 'attack' },
  gentle: { increased: 'special-defense', decreased: 'defense' },
  sassy: { increased: 'special-defense', decreased: 'speed' },
  careful: { increased: 'special-defense', decreased: 'special-attack' },
  quirky: { increased: null, decreased: null },
} as const satisfies Record<string, Nature>;

export type NatureName = keyof typeof NATURES;

export const NATURE_NAMES = Object.keys(NATURES) as NatureName[];

/** Flavor associated with each stat: liked when boosted, disliked when lowered. */
export const FLAVOR_BY_STAT: Readonly<Record<NatureStat, Flavor>> = {
  attack: 'spicy',
  defense: 'sour',
  'special-attack': 'dry',
  'special-defense': 'bitter',
  speed: 'sweet',
};

export function isNatureName(value: string): value is NatureName {
  return Object.hasOwn(NATURES, value);
}

/** Stat multiplier applied by a nature (1.1, 0.9 or 1). HP is never affected. */
export function natureMultiplier(nature: NatureName, stat: NatureStat | 'hp'): 1.1 | 0.9 | 1 {
  const { increased, decreased }: Nature = NATURES[nature];
  if (stat === increased) return 1.1;
  if (stat === decreased) return 0.9;
  return 1;
}

/** Liked/disliked flavors (RF07.2), or null for neutral natures. */
export function natureFlavors(nature: NatureName): { likes: Flavor; hates: Flavor } | null {
  const { increased, decreased }: Nature = NATURES[nature];
  if (increased === null || decreased === null) return null;
  return { likes: FLAVOR_BY_STAT[increased], hates: FLAVOR_BY_STAT[decreased] };
}
