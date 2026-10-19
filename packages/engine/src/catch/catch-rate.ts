import type { Generation } from '../generations';
import type { TypeName } from '../types/type-names';

/**
 * Capture formulas of the main series (RF11.2), with the games' integer arithmetic:
 * - Gen 1: R1/F checks (pokered `ItemUseBall`), closed form for an uncorrelated RNG;
 * - Gen 2: one 8-bit check (pokecrystal `PokeBallEffect`), its bugs included;
 * - Gen 3–4: `a` and four shake checks against `b` (pokeemerald / pokeplatinum / pokeheartgold);
 * - Gen 5–9: 4096-based fixed point, critical captures, 3 (Gen 5) or 4 shake checks.
 * Let's Go, Legends: Arceus / Z-A and Colosseum/XD use other systems and are not covered.
 */

export const CATCH_STATUSES = ['none', 'sleep', 'freeze', 'paralysis', 'burn', 'poison'] as const;
export type CatchStatus = (typeof CATCH_STATUSES)[number];

/** The wild Pokémon, for ball conditions (Net, Heavy, Fast, Moon, Beast…). */
export interface CatchTarget {
  readonly speciesId?: number;
  readonly types?: readonly TypeName[];
  /** Weight in hectograms (PokeAPI). */
  readonly weightHg?: number;
  readonly baseSpeed?: number;
}

/** Battle and game conditions that change a ball or the formula. */
export interface CatchConditions {
  /** Turns already completed (0 = first turn): Quick and Timer Balls. */
  readonly turn?: number;
  /** Night (Dusk Ball). */
  readonly night?: boolean;
  /** In a cave (Dusk Ball). */
  readonly cave?: boolean;
  readonly fishing?: boolean;
  readonly surfing?: boolean;
  /** Underwater (Gen 3 Dive Ball). */
  readonly underwater?: boolean;
  /** The species is registered as caught (Repeat Ball). */
  readonly alreadyCaught?: boolean;
  /** Level of your active Pokémon (Level Ball; Gen 8 under-level penalty compares it). */
  readonly playerLevel?: number;
  /** Your active Pokémon is the same species, of the same or the opposite gender (Love Ball). */
  readonly loveMatch?: 'same-gender' | 'opposite-gender' | null;
  /** Species registered as caught in the Pokédex (critical captures, Gen 5 dark grass). */
  readonly speciesCaught?: number;
  /** Gen 5: in dark grass. */
  readonly darkGrass?: boolean;
  /** Gen 8–9: Catching Charm (critical captures ×2). */
  readonly catchingCharm?: boolean;
  /** Gen 5 Pass Power (110/120/130), Gen 6 O-Power (150/200/250), Gen 7 Roto Catch (200), %. */
  readonly captureBonus?: number;
  /** Gen 8: the wild Pokémon outlevels yours and you lack the 8th badge (×0.1). */
  readonly underLevelPenalty?: boolean;
  /** Gen 9: badges (0–8), for the over-level penalty. */
  readonly badges?: number;
  /** Gen 9: Catching Power level 0–3 (sandwich). */
  readonly catchingPower?: 0 | 1 | 2 | 3;
  /** Gen 9: thrown at a Pokémon that has not noticed you (×2). */
  readonly offGuard?: boolean;
}

export interface CatchInput {
  readonly gen: Generation;
  /** Species catch rate (1–255). */
  readonly catchRate: number;
  readonly maxHp: number;
  readonly currentHp: number;
  /** Wild Pokémon's level. */
  readonly level: number;
  readonly status: CatchStatus;
  /** Ball item identifier (PokeAPI: `poke-ball`, `ultra-ball`…); unknown balls count as ×1. */
  readonly ball: string;
  readonly target?: CatchTarget;
  readonly conditions?: CatchConditions;
}

export interface CatchResult {
  /** Chance of catching with this throw (0–1). */
  readonly probability: number;
  /** Chance of a critical capture (Gen 5+; 0 before). */
  readonly criticalChance: number;
  /** Chance of passing one shake check (Gen 3+), null when there are none. */
  readonly shakeProbability: number | null;
  /** Caught without any check (Master Ball, overflowing catch value…). */
  readonly guaranteed: boolean;
  /**
   * Modified catch value on the 0–255 scale: `a` (Gen 2–4) or X / 4096 (Gen 5+); null in
   * Gen 1, which has no single value.
   */
  readonly catchValue: number | null;
  /** True when the Gen 3–4 value would be 0 (a division by zero in the games), raised to 1. */
  readonly clamped: boolean;
}

/** Ultra Beasts (Gen 7+: only the Beast Ball works well on them). */
export const ULTRA_BEAST_SPECIES: ReadonlySet<number> = new Set([
  793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806,
]);

/** Gen 2 Fast Ball: a bug limits it to Magnemite, Grimer and Tangela. */
const GEN2_FAST_BALL_SPECIES: ReadonlySet<number> = new Set([81, 88, 114]);

/** HGSS Moon Ball: the Moon Stone families. */
const HGSS_MOON_BALL_SPECIES: ReadonlySet<number> = new Set([
  29, 30, 31, 32, 33, 34, 35, 36, 39, 40, 173, 174, 300, 301,
]);

/** Gen 5+ Moon Ball: species that evolve with a Moon Stone. */
const MOON_BALL_SPECIES: ReadonlySet<number> = new Set([30, 33, 35, 39, 300, 517]);

/** Fixed-point unit of Gen 5+ (1.0 = 4096); X ≥ 255 × 4096 is a guaranteed capture. */
const FP = 4096;
const FP_255 = 255 * FP;

/** Gen 9 badge penalty by the number of level caps the wild Pokémon exceeds. */
const BADGE_PENALTY = [4096, 3277, 2621, 2097, 1678, 1342, 1074, 859, 687] as const;
/** Gen 9 obedience level + 5 for 0–7 badges. */
const BADGE_CAPS = [25, 30, 35, 40, 45, 50, 55, 60] as const;

function assertInteger(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer in [${min}, ${max}], got ${value}`);
  }
}

/** Round half up: ⌊(2n + d) / 2d⌋. */
function rhu(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

const isqrt = (n: number) => Math.floor(Math.sqrt(n));

/** Chance of catching within `throws` throws at a constant per-throw `probability`. */
export function cumulativeCatchChance(probability: number, throws: number): number {
  return 1 - (1 - probability) ** throws;
}

/** Critical capture multiplier (4096 = ×1) by species caught (Gen 5+). */
export function criticalCaptureMultiplier(speciesCaught: number): number {
  if (speciesCaught > 600) return 10240;
  if (speciesCaught > 450) return 8192;
  if (speciesCaught > 300) return 6144;
  if (speciesCaught > 150) return 4096;
  if (speciesCaught > 30) return 2048;
  return 0;
}

/** Gen 5 dark grass multiplier (4096 = ×1) by species caught. */
function darkGrassMultiplier(speciesCaught: number): number {
  if (speciesCaught > 600) return 4096;
  if (speciesCaught > 450) return 3686;
  if (speciesCaught > 300) return 3277;
  if (speciesCaught > 150) return 2867;
  if (speciesCaught > 30) return 2048;
  return 1229;
}

/** Level Ball factor: strict comparisons in Gen 2 and HGSS, "at least" from Gen 5. */
function levelBallFactor(gen: Generation, player: number | undefined, wild: number): number {
  if (player === undefined) return 1;
  if (gen <= 4) {
    if (wild >= player) return 1;
    if (wild >= Math.floor(player / 2)) return 2;
    if (wild >= Math.floor(player / 4)) return 4;
    return 8;
  }
  if (Math.floor(player / 4) >= wild) return 8;
  if (Math.floor(player / 2) >= wild) return 4;
  return player > wild ? 2 : 1;
}

/** Heavy Ball catch-rate modifier by weight (hg). HGSS has no 0 tier (a bug). */
function heavyBallModifier(gen: Generation, weightHg: number): number {
  if (gen === 2) {
    if (weightHg < 1024) return -20;
    if (weightHg < 2048) return 0;
    if (weightHg < 3072) return 20;
    return weightHg < 4096 ? 30 : 40;
  }
  if (gen === 4) {
    if (weightHg >= 4096) return 40;
    if (weightHg >= 3072) return 30;
    return weightHg >= 2048 ? 20 : -20;
  }
  if (weightHg >= 3000) return 30;
  if (weightHg >= 2000) return 20;
  return weightHg >= 1000 ? 0 : -20;
}

const capRate = (rate: number) => Math.min(255, rate);

// --- Gen 1 -----------------------------------------------------------------------------------

function gen1(input: CatchInput): CatchResult {
  const { catchRate: c, maxHp: m, currentHp: h, ball, status } = input;
  const range =
    ball === 'great-ball' ? 200 : ball === 'ultra-ball' || ball === 'safari-ball' ? 150 : 255;
  const s = status === 'sleep' || status === 'freeze' ? 25 : status === 'none' ? 0 : 12;
  const g = ball === 'great-ball' ? 8 : 12;
  const w = Math.floor(Math.floor((m * 255) / g) / Math.max(1, Math.floor(h / 4)));
  const f = Math.min(w, 255);
  const b = range + 1;
  // P = S/B + min(C+1, B−S)/B × (F+1)/256, over a common denominator to stay exact.
  const numerator = s * 256 + Math.min(c + 1, b - s) * (f + 1);
  return {
    probability: numerator / (b * 256),
    criticalChance: 0,
    shakeProbability: null,
    guaranteed: numerator === b * 256,
    catchValue: null,
    clamped: false,
  };
}

// --- Gen 2 -----------------------------------------------------------------------------------

function gen2Rate(input: CatchInput): number {
  const { catchRate: c, ball, target = {}, conditions = {} } = input;
  switch (ball) {
    case 'great-ball':
    case 'park-ball':
    case 'sport-ball':
      return capRate(c + Math.floor(c / 2));
    case 'ultra-ball':
      return capRate(c * 2);
    case 'fast-ball':
      return GEN2_FAST_BALL_SPECIES.has(target.speciesId ?? 0) ? capRate(c * 4) : c;
    case 'level-ball':
      return capRate(c * levelBallFactor(2, conditions.playerLevel, input.level));
    case 'lure-ball':
      return conditions.fishing ? capRate(c * 3) : c;
    case 'love-ball':
      // Bug: the check compares for the same gender.
      return conditions.loveMatch === 'same-gender' ? capRate(c * 8) : c;
    case 'heavy-ball':
      return capRate(Math.max(1, c + heavyBallModifier(2, target.weightHg ?? 0)));
    default:
      // Poké, Friend, and the Moon Ball (a bug makes it never apply).
      return c;
  }
}

function gen2(input: CatchInput): CatchResult {
  const rate = gen2Rate(input);
  let a: number;
  if (input.ball === 'level-ball') {
    // Bug: the Level Ball skips the HP term and the status bonus.
    a = rate;
  } else {
    let m = 3 * input.maxHp;
    let h = 2 * input.currentHp;
    if (m > 255) {
      m = Math.floor(m / 4) & 0xff;
      h = Math.max(1, Math.floor(h / 4) & 0xff);
    }
    if (m === 0) throw new RangeError('This max HP divides by zero in Gen 2 (the game freezes)');
    const x = Math.max(1, Math.floor((rate * ((m - h) & 0xff)) / m));
    // Bug: poison, burn and paralysis should add 5 but add nothing.
    const bonus = input.status === 'sleep' || input.status === 'freeze' ? 10 : 0;
    a = Math.min(255, x + bonus);
  }
  return {
    probability: (a + 1) / 256,
    criticalChance: 0,
    shakeProbability: null,
    guaranteed: a === 255,
    catchValue: a,
    clamped: false,
  };
}

// --- Gen 3–4 ---------------------------------------------------------------------------------

/** Catch rate (HGSS Apricorn Balls change it) and ball multiplier ×10. */
function gen34Ball(input: CatchInput): { rate: number; ball10: number } {
  const { gen, catchRate: c, ball, level, target = {}, conditions = {} } = input;
  const turn = conditions.turn ?? 0;
  const types = target.types ?? [];
  const plain = (ball10: number) => ({ rate: c, ball10 });
  const apricorn = (rate: number) => ({ rate: rate < 0 ? 1 : capRate(rate), ball10: 10 });
  switch (ball) {
    case 'great-ball':
    case 'safari-ball':
      return plain(15);
    case 'ultra-ball':
      return plain(20);
    case 'net-ball':
      return plain(types.includes('water') || types.includes('bug') ? 30 : 10);
    case 'dive-ball': {
      const water = gen === 3 ? conditions.underwater : conditions.surfing || conditions.fishing;
      return plain(water ? 35 : 10);
    }
    case 'nest-ball':
      return plain(level < 40 ? Math.max(40 - level, 10) : 10);
    case 'repeat-ball':
      return plain(conditions.alreadyCaught ? 30 : 10);
    case 'timer-ball':
      return plain(Math.min(10 + turn, 40));
  }
  if (gen === 4) {
    switch (ball) {
      case 'sport-ball':
        return plain(15);
      case 'dusk-ball':
        return plain(conditions.night || conditions.cave ? 35 : 10);
      case 'quick-ball':
        return plain(turn === 0 ? 40 : 10);
      case 'fast-ball':
        return apricorn((target.baseSpeed ?? 0) >= 100 ? c * 4 : c);
      case 'level-ball':
        return apricorn(c * levelBallFactor(4, conditions.playerLevel, level));
      case 'lure-ball':
        return apricorn(conditions.fishing ? c * 3 : c);
      case 'heavy-ball':
        return apricorn(c + heavyBallModifier(4, target.weightHg ?? 0));
      case 'love-ball':
        return apricorn(conditions.loveMatch === 'opposite-gender' ? c * 8 : c);
      case 'moon-ball':
        return apricorn(HGSS_MOON_BALL_SPECIES.has(target.speciesId ?? 0) ? c * 4 : c);
    }
  }
  // Poké, Luxury, Premier, Heal, Cherish, Friend and unknown balls.
  return plain(10);
}

function gen34(input: CatchInput): CatchResult {
  const { maxHp: m, currentHp: h, status } = input;
  const { rate, ball10 } = gen34Ball(input);
  const k = Math.floor((rate * ball10) / 10);
  let a = Math.floor((k * (3 * m - 2 * h)) / (3 * m));
  if (status === 'sleep' || status === 'freeze') a *= 2;
  else if (status !== 'none') a = Math.floor((a * 15) / 10);
  if (a >= 255) return guaranteedResult(a);
  const clamped = a < 1;
  a = Math.max(1, a);
  const b = Math.floor(1048560 / isqrt(isqrt(Math.floor(16711680 / a))));
  const p = b / 65536;
  return {
    probability: p ** 4,
    criticalChance: 0,
    shakeProbability: p,
    guaranteed: false,
    catchValue: a,
    clamped,
  };
}

// --- Gen 5–9 ---------------------------------------------------------------------------------

/** Catch rate (the Heavy Ball changes it) and ball multiplier (4096 = ×1). */
function modernBall(input: CatchInput): { rate: number; b4: number } {
  const { gen, catchRate: c, ball, level, target = {}, conditions = {} } = input;
  const turn = conditions.turn ?? 0;
  const types = target.types ?? [];
  const water = conditions.surfing || conditions.fishing || conditions.underwater;
  const ultraBeast = gen >= 7 && ULTRA_BEAST_SPECIES.has(target.speciesId ?? 0);
  let rate = c;
  let b4 = FP;
  switch (ball) {
    case 'great-ball':
      b4 = 6144;
      break;
    case 'ultra-ball':
      b4 = 8192;
      break;
    case 'safari-ball':
    case 'sport-ball':
      b4 = gen <= 7 ? 6144 : FP;
      break;
    case 'net-ball':
      if (types.includes('water') || types.includes('bug')) b4 = gen <= 6 ? 12288 : 14336;
      break;
    case 'dive-ball':
      if (water) b4 = 14336;
      break;
    case 'nest-ball':
      if (gen === 5) b4 = Math.max(Math.floor(((41 - level) * FP) / 10), FP);
      else if (level <= 29) b4 = Math.floor(((41 - level) * FP) / 10);
      break;
    case 'repeat-ball':
      if (conditions.alreadyCaught) b4 = gen <= 6 ? 12288 : 14336;
      break;
    case 'timer-ball':
      b4 = Math.min(FP + 1229 * turn, 16384);
      break;
    case 'dusk-ball':
      if (conditions.night || conditions.cave) b4 = gen <= 6 ? 14336 : 12288;
      break;
    case 'quick-ball':
      if (turn === 0) b4 = 20480;
      break;
    case 'dream-ball':
      if (gen >= 8 && input.status === 'sleep') b4 = 16384;
      break;
    case 'beast-ball':
      b4 = ultraBeast ? 20480 : 410;
      break;
    case 'fast-ball':
      if ((target.baseSpeed ?? 0) >= 100) b4 = 16384;
      break;
    case 'level-ball':
      b4 = FP * levelBallFactor(gen, conditions.playerLevel, level);
      break;
    case 'lure-ball': {
      const lured = gen === 9 ? conditions.fishing || conditions.surfing : conditions.fishing;
      if (lured) b4 = gen <= 6 ? 12288 : gen === 7 ? 20480 : 16384;
      break;
    }
    case 'love-ball':
      if (conditions.loveMatch === 'opposite-gender') b4 = 32768;
      break;
    case 'moon-ball':
      if (MOON_BALL_SPECIES.has(target.speciesId ?? 0)) b4 = 16384;
      break;
    case 'heavy-ball':
      rate = capRate(Math.max(1, c + heavyBallModifier(gen, target.weightHg ?? 0)));
      break;
  }
  // Every ball but the Beast Ball barely works on Ultra Beasts.
  if (ultraBeast && ball !== 'beast-ball') b4 = 410;
  return { rate, b4 };
}

/** Gen 9: badge penalty when the wild Pokémon exceeds the level caps of missing badges. */
function badgePenalty(level: number, badges: number): number {
  let exceeded = 0;
  for (let badge = badges; badge < BADGE_CAPS.length; badge++) {
    if (BADGE_CAPS[badge]! < level) exceeded++;
  }
  return BADGE_PENALTY[exceeded]!;
}

/** Shake-check threshold Y (out of 65536) from X, with the games' fixed-point roots. */
function shakeThreshold(gen: Generation, x: number): number {
  const r1 = rhu(FP_255 * FP, x);
  let s: number;
  if (gen === 5) {
    const s1 = Math.floor(Math.sqrt(r1 / FP) * FP + 0.5);
    s = Math.floor(Math.sqrt(s1 / FP) * FP + 0.5);
  } else {
    s = Math.floor(Math.fround(Math.pow(r1 / FP, 0.1875)) * FP + 0.5);
  }
  const t = rhu(65536 * FP * FP, s);
  return Math.min(Math.floor(t / FP), 65536);
}

function modern(input: CatchInput): CatchResult {
  const { gen, maxHp: m, currentHp: h, level, status, conditions = {} } = input;
  const caught = conditions.speciesCaught ?? 0;
  if (input.ball === 'dream-ball' && gen === 5) return guaranteedResult(255);
  const { rate, b4 } = modernBall(input);

  const grass = gen === 5 && conditions.darkGrass ? darkGrassMultiplier(caught) : FP;
  let a = rhu((3 * m - 2 * h) * grass * rate * b4, FP);
  if (gen === 9) a = rhu(a * badgePenalty(level, conditions.badges ?? 8), FP);
  let x = Math.floor(a / (3 * m));
  if (gen === 8 && level < 21) x = Math.floor((x * (30 - level)) / 10);
  if (gen === 9 && level < 13) x = Math.floor((x * (36 - 2 * level)) / 10);
  const statusFp =
    status === 'sleep' || status === 'freeze' ? 10240 : status === 'none' ? FP : 6144;
  x = rhu(x * statusFp, FP);
  if (gen <= 7) x = Math.floor((x * (conditions.captureBonus ?? 100)) / 100);
  if (gen === 8 && conditions.underLevelPenalty) x = rhu(x * 410, FP);
  if (gen === 9) {
    const power = (
      [
        [1, 1],
        [11, 10],
        [5, 4],
        [2, 1],
      ] as const
    )[conditions.catchingPower ?? 0];
    x = rhu(x * power[0] * (conditions.offGuard ? 2 : 1), power[1]);
  }
  // x ≥ 1 here: the smallest factors (catch rate 1, ×0.1 balls and penalties) keep it above 0.
  if (x >= FP_255) return guaranteedResult(255);

  const charm = gen >= 8 && conditions.catchingCharm ? 2 : 1;
  const critical = Math.floor(rhu(x * criticalCaptureMultiplier(caught) * charm, FP) / 24576);
  const criticalChance = critical / 256;
  const p = shakeThreshold(gen, x) / 65536;
  const checks = gen === 5 ? 3 : 4;
  return {
    probability: criticalChance * p + (1 - criticalChance) * p ** checks,
    criticalChance,
    shakeProbability: p,
    guaranteed: false,
    catchValue: x / FP,
    clamped: false,
  };
}

function guaranteedResult(catchValue: number): CatchResult {
  return {
    probability: 1,
    criticalChance: 0,
    shakeProbability: null,
    guaranteed: true,
    catchValue,
    clamped: false,
  };
}

/** Chance of catching a wild Pokémon with one throw (RF11.2), with the generation's formula. */
export function catchChance(input: CatchInput): CatchResult {
  const { gen } = input;
  assertInteger('Catch rate', input.catchRate, 1, 255);
  assertInteger('Max HP', input.maxHp, 1, 999);
  assertInteger('Current HP', input.currentHp, 1, input.maxHp);
  assertInteger('Level', input.level, 1, 100);
  const { conditions = {} } = input;
  assertInteger('Turn', conditions.turn ?? 0, 0, 999);
  assertInteger('Your level', conditions.playerLevel ?? 1, 1, 100);
  assertInteger('Species caught', conditions.speciesCaught ?? 0, 0, 9999);
  assertInteger('Capture bonus', conditions.captureBonus ?? 100, 100, 300);
  assertInteger('Badges', conditions.badges ?? 8, 0, 8);
  if (input.ball === 'master-ball' || (gen === 4 && input.ball === 'park-ball')) {
    return guaranteedResult(255);
  }
  if (gen === 1) return gen1(input);
  if (gen === 2) return gen2(input);
  if (gen <= 4) return gen34(input);
  return modern(input);
}
