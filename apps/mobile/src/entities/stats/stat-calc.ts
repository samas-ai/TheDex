import {
  calcStat,
  dvFromIv,
  evLimits,
  hpDv,
  maxIv,
  natureMultiplier,
  possibleIvs,
  statExpFromEv,
  type Generation,
  type NatureName,
  type ShowdownStat,
  type StatName,
  type StatsTable,
} from '@thedex/engine';
import type { PokemonStats } from '@thedex/db';

/**
 * Stats of a spread on Showdown's keys (team builder RF08.2, stat calculator RF11.1). IVs are on
 * the game's scale (DVs 0–15 in Gen 1–2) and EVs on Showdown's 0–255 scale in every generation
 * (Gen 1–2 Stat Exp = EV², see `statExpFromEv`).
 */
export interface Spread {
  readonly level: number;
  /** Null = neutral (and always in Gen 1–2). */
  readonly nature: NatureName | null;
  readonly ivs: StatsTable;
  readonly evs: StatsTable;
}

const ENGINE_STATS: Readonly<Record<ShowdownStat, StatName>> = {
  hp: 'hp',
  atk: 'attack',
  def: 'defense',
  spa: 'special-attack',
  spd: 'special-defense',
  spe: 'speed',
};

/** Stats a generation shows: Gen 1 has a single Special, kept under `spa`. */
export function statsOf(gen: Generation): ShowdownStat[] {
  return gen === 1 ? ['hp', 'atk', 'def', 'spa', 'spe'] : ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
}

/** Engine / PokeAPI stat identifier of a Showdown key (`spa` is `special` in Gen 1). */
export function engineStat(stat: ShowdownStat, gen: Generation): StatName {
  return gen === 1 && stat === 'spa' ? 'special' : ENGINE_STATS[stat];
}

/** Base stat of a key in the generation (Gen 1 Special under `spa`). */
export function baseOf(stats: PokemonStats, stat: ShowdownStat, gen: Generation): number {
  switch (stat) {
    case 'hp':
      return stats.hp;
    case 'atk':
      return stats.attack;
    case 'def':
      return stats.defense;
    case 'spa':
      return gen === 1 ? (stats.special ?? stats.specialAttack) : stats.specialAttack;
    case 'spd':
      return stats.specialDefense;
    case 'spe':
      return stats.speed;
  }
}

/** Nature multiplier of a stat (neutral for HP, without a nature, and before Gen 3). */
export function natureEffect(
  nature: NatureName | null,
  stat: ShowdownStat,
  gen: Generation,
): 0.9 | 1 | 1.1 {
  if (nature === null || gen <= 2 || stat === 'hp') return 1;
  return natureMultiplier(nature, ENGINE_STATS[stat] as Exclude<StatName, 'hp' | 'special'>);
}

/**
 * Showdown IVs (0–31 in every generation) as the game uses them: in Gen 1–2, DVs with the HP DV
 * derived from the others and Sp. Def sharing the Special DV.
 */
export function gameIvs(showdownIvs: StatsTable, gen: Generation): StatsTable {
  if (gen >= 3) return showdownIvs;
  const atk = dvFromIv(showdownIvs.atk);
  const def = dvFromIv(showdownIvs.def);
  const spa = dvFromIv(showdownIvs.spa);
  const spe = dvFromIv(showdownIvs.spe);
  return {
    hp: hpDv({ attack: atk, defense: def, speed: spe, special: spa }),
    atk,
    def,
    spa,
    spd: spa,
    spe,
  };
}

/**
 * Engine EV (Stat Exp in Gen 1–2) for an EV on Showdown's scale; values over the generation's
 * cap (an imported 255, a team moved to Gen 6+) count as the cap.
 */
function engineEv(ev: number, gen: Generation): number {
  return gen <= 2 ? statExpFromEv(Math.min(ev, 255)) : Math.min(ev, evLimits(gen).perStat);
}

/** One final stat; `iv` on the game's scale (capped), `ev` on Showdown's. */
export function statValue(input: {
  readonly gen: Generation;
  readonly stat: ShowdownStat;
  readonly base: number;
  readonly level: number;
  readonly iv: number;
  readonly ev: number;
  readonly nature: NatureName | null;
}): number {
  const { gen, stat } = input;
  return calcStat({
    gen,
    stat: engineStat(stat, gen),
    base: input.base,
    level: input.level,
    iv: Math.min(input.iv, maxIv(gen)),
    ev: engineEv(input.ev, gen),
    nature: natureEffect(input.nature, stat, gen),
  });
}

/** Every stat of the generation for a spread (IVs on the game's scale). */
export function finalStats(
  base: PokemonStats,
  spread: Spread,
  gen: Generation,
): Partial<Record<ShowdownStat, number>> {
  const result: Partial<Record<ShowdownStat, number>> = {};
  for (const stat of statsOf(gen)) {
    result[stat] = statValue({
      gen,
      stat,
      base: baseOf(base, stat, gen),
      level: spread.level,
      iv: spread.ivs[stat],
      ev: spread.evs[stat],
      nature: spread.nature,
    });
  }
  return result;
}

/** Reverse calculation (RF11.1): IVs (DVs in Gen 1–2) that give the observed `value`. */
export function ivCandidates(input: {
  readonly gen: Generation;
  readonly stat: ShowdownStat;
  readonly base: number;
  readonly level: number;
  readonly ev: number;
  readonly nature: NatureName | null;
  readonly value: number;
}): number[] {
  const { gen, stat } = input;
  return possibleIvs({
    gen,
    stat: engineStat(stat, gen),
    base: input.base,
    level: input.level,
    ev: engineEv(input.ev, gen),
    nature: natureEffect(input.nature, stat, gen),
    value: input.value,
  });
}

/** `24`, `11–12`, or null when no IV fits. Candidates are ascending. */
export function formatIvRange(ivs: readonly number[]): string | null {
  if (ivs.length === 0) return null;
  const first = ivs[0]!;
  const last = ivs[ivs.length - 1]!;
  return first === last ? String(first) : `${first}–${last}`;
}
