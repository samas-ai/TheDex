import type { Generation } from '../generations';
import type { NatureStat } from '../natures/natures';

/** Permanent stats, using PokeAPI identifiers. `special` exists only in Gen 1. */
export type StatName = 'hp' | NatureStat | 'special';

/** Nature effect on a stat: 0.9 (hindering), 1 (neutral) or 1.1 (beneficial). */
export type NatureEffect = 0.9 | 1 | 1.1;

export interface StatInput {
  readonly gen: Generation;
  readonly stat: StatName;
  readonly base: number;
  readonly level: number;
  /** IV (0–31) from Gen 3; DV (0–15) in Gen 1–2. */
  readonly iv: number;
  /** EV (0–255, 0–252 from Gen 6) from Gen 3; Stat Experience (0–65535) in Gen 1–2. */
  readonly ev: number;
  /** Nature multiplier (Gen 3+, never applied to HP). Neutral when omitted. */
  readonly nature?: NatureEffect;
}

export interface EvLimits {
  /** Maximum per stat (Stat Experience in Gen 1–2). */
  readonly perStat: number;
  /** Maximum total, or null when there is none (Gen 1–2). */
  readonly total: number | null;
}

/** Maximum IV (DV in Gen 1–2). */
export function maxIv(gen: Generation): number {
  return gen <= 2 ? 15 : 31;
}

/**
 * EV caps: Gen 1–2 Stat Experience is 65535 in every stat (252 in all stats is legal in
 * Showdown terms); Gen 3–5 allow 255 per stat, Gen 6+ 252, both with 510 in total.
 */
export function evLimits(gen: Generation): EvLimits {
  if (gen <= 2) return { perStat: 65535, total: null };
  return { perStat: gen <= 5 ? 255 : 252, total: 510 };
}

/**
 * EV caps on Showdown's 0–255 scale (team builder, calculators): 252 per stat from Gen 6 and in
 * Gen 1–2 (where 252 everywhere is legal: no total), 255 in Gen 3–5; 510 in total from Gen 3.
 */
export function showdownEvLimits(gen: Generation): EvLimits {
  if (gen <= 2) return { perStat: 252, total: null };
  return { perStat: gen <= 5 ? 255 : 252, total: 510 };
}

function assertInteger(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer in [${min}, ${max}], got ${value}`);
  }
}

function assertStatExists(stat: StatName, gen: Generation): void {
  if (stat === 'special' && gen !== 1) {
    throw new RangeError('The unified Special stat only exists in generation 1');
  }
  if ((stat === 'special-attack' || stat === 'special-defense') && gen === 1) {
    throw new RangeError(`"${stat}" does not exist in generation 1 (use "special")`);
  }
}

/** Smallest integer whose square is ≥ n (the Gen 1–2 games' Stat Experience root). */
function ceilSqrt(n: number): number {
  const root = Math.floor(Math.sqrt(n));
  return root * root < n ? root + 1 : root;
}

/**
 * Gen 1–2 Stat Experience bonus: ⌊min(255, ⌈√statExp⌉) / 4⌋, so 65535 gives 63 (the games
 * cap the root at 255 — same as Showdown's 252 EVs → 63).
 */
export function statExpBonus(statExp: number): number {
  assertInteger('Stat Experience', statExp, 0, 65535);
  return Math.floor(Math.min(255, ceilSqrt(statExp)) / 4);
}

/**
 * Gen 1–2 HP DV, derived from the lowest bit of the Attack, Defense, Speed and Special DVs.
 */
export function hpDv(dvs: {
  readonly attack: number;
  readonly defense: number;
  readonly speed: number;
  readonly special: number;
}): number {
  for (const [name, dv] of Object.entries(dvs)) assertInteger(`${name} DV`, dv, 0, 15);
  return (
    ((dvs.attack & 1) << 3) | ((dvs.defense & 1) << 2) | ((dvs.speed & 1) << 1) | (dvs.special & 1)
  );
}

/**
 * Final stat value (RF02.4 / RF11.1), with the in-game integer arithmetic:
 * - Gen 1–2: ⌊((Base + DV) × 2 + bonus(StatExp)) × L / 100⌋ + 5 (HP: + L + 10);
 * - Gen 3+: ⌊(⌊(2 × Base + IV + ⌊EV / 4⌋) × L / 100⌋ + 5) × Nature⌋ (HP: + L + 10);
 * - Shedinja (base HP 1) always has 1 HP.
 */
export function calcStat(input: StatInput): number {
  const { gen, stat, base, level, iv, ev } = input;
  const nature = input.nature ?? 1;
  assertStatExists(stat, gen);
  assertInteger('Base stat', base, 1, 255);
  assertInteger('Level', level, 1, 100);
  assertInteger(gen <= 2 ? 'DV' : 'IV', iv, 0, maxIv(gen));
  assertInteger(gen <= 2 ? 'Stat Experience' : 'EV', ev, 0, evLimits(gen).perStat);
  if (nature !== 1 && (gen <= 2 || stat === 'hp')) {
    throw new RangeError(
      stat === 'hp' ? 'Natures never affect HP' : 'Natures do not exist before generation 3',
    );
  }

  if (gen <= 2) {
    const core = Math.floor((((base + iv) * 2 + statExpBonus(ev)) * level) / 100);
    return stat === 'hp' ? core + level + 10 : core + 5;
  }

  if (stat === 'hp' && base === 1) return 1;
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  if (stat === 'hp') return core + level + 10;
  // Integer percentages avoid floating-point drift (e.g. 1.1 × 205).
  return Math.floor(((core + 5) * Math.round(nature * 100)) / 100);
}

export interface StatBounds {
  /** 0 IV/DV, 0 EV/Stat Exp, hindering nature. */
  readonly min: number;
  /** 0 IV/DV, 0 EV/Stat Exp, neutral nature. */
  readonly minNeutral: number;
  /** Max IV/DV, 252 EV (65535 Stat Exp), neutral nature. */
  readonly maxNeutral: number;
  /** Max IV/DV, 252 EV (65535 Stat Exp), beneficial nature. */
  readonly max: number;
}

/** Minimum and maximum of a stat at a level (RF02.4: Lv. 50 and Lv. 100 columns). */
export function statBounds(input: Omit<StatInput, 'iv' | 'ev' | 'nature'>): StatBounds {
  const { gen, stat } = input;
  const maxEv = gen <= 2 ? 65535 : 252;
  const minNeutral = calcStat({ ...input, iv: 0, ev: 0 });
  const maxNeutral = calcStat({ ...input, iv: maxIv(gen), ev: maxEv });
  if (gen <= 2 || stat === 'hp')
    return { min: minNeutral, minNeutral, maxNeutral, max: maxNeutral };
  return {
    min: calcStat({ ...input, iv: 0, ev: 0, nature: 0.9 }),
    minNeutral,
    maxNeutral,
    max: calcStat({ ...input, iv: maxIv(gen), ev: maxEv, nature: 1.1 }),
  };
}

/**
 * Gen 1–2 Stat Experience for an EV on Showdown's scale: Stat Exp = EV², so the bonus is
 * ⌊EV / 4⌋ exactly as in later generations (252 → 63, the maximum).
 */
export function statExpFromEv(ev: number): number {
  assertInteger('EV', ev, 0, 255);
  return ev * ev;
}

/**
 * Reverse calculation (RF11.1): every IV (DV in Gen 1–2) that gives `value` with the other
 * inputs, ascending. Empty when none does (wrong level, EVs or nature, or an impossible value).
 */
export function possibleIvs(input: Omit<StatInput, 'iv'> & { readonly value: number }): number[] {
  const { value, ...rest } = input;
  const ivs: number[] = [];
  for (let iv = 0; iv <= maxIv(input.gen); iv++) {
    if (calcStat({ ...rest, iv }) === value) ivs.push(iv);
  }
  return ivs;
}
