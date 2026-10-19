import { calcStat, type Generation } from '@thedex/engine';

/** Games whose capture system is not their generation's formula (the calculator warns). */
export const OTHER_CAPTURE_SYSTEMS: ReadonlySet<string> = new Set([
  'colosseum',
  'xd',
  'lets-go-pikachu-lets-go-eevee',
  'legends-arceus',
  'legends-za',
  'champions',
]);

/**
 * Max HP of a wild Pokémon for the calculator: mid-range IV (15, DV 7) and no EVs, since wild
 * IVs are random. Shedinja keeps its 1 HP.
 */
export function wildMaxHp(baseHp: number, level: number, gen: Generation): number {
  return calcStat({ gen, stat: 'hp', base: baseHp, level, iv: gen <= 2 ? 7 : 15, ev: 0 });
}

/** HP left at `percent` of the max, at least 1 (a fainted Pokémon cannot be caught). */
export function hpFromPercent(maxHp: number, percent: number): number {
  return Math.max(1, Math.min(maxHp, Math.round((maxHp * percent) / 100)));
}

/** Capture boosts by generation: Pass Power (5), O-Power (6), Roto Catch (7), in %. */
export function captureBonusOptions(gen: Generation): readonly number[] {
  switch (gen) {
    case 5:
      return [100, 110, 120, 130];
    case 6:
      return [100, 150, 200, 250];
    case 7:
      return [100, 200];
    default:
      return [];
  }
}

/** Inputs the calculator asks for, depending on the ball and the generation. */
export type ConditionKey =
  | 'turn'
  | 'night'
  | 'cave'
  | 'fishing'
  | 'surfing'
  | 'underwater'
  | 'alreadyCaught'
  | 'playerLevel'
  | 'loveMatch'
  | 'speciesCaught'
  | 'darkGrass'
  | 'catchingCharm'
  | 'captureBonus'
  | 'underLevelPenalty'
  | 'badges'
  | 'catchingPower'
  | 'offGuard';

export function relevantConditions(ball: string, gen: Generation): ReadonlySet<ConditionKey> {
  const keys = new Set<ConditionKey>();
  switch (ball) {
    case 'quick-ball':
    case 'timer-ball':
      keys.add('turn');
      break;
    case 'dusk-ball':
      keys.add('night').add('cave');
      break;
    case 'dive-ball':
      if (gen === 3 || gen >= 5) keys.add('underwater');
      if (gen >= 4) keys.add('surfing').add('fishing');
      break;
    case 'lure-ball':
      keys.add('fishing');
      if (gen === 9) keys.add('surfing');
      break;
    case 'repeat-ball':
      keys.add('alreadyCaught');
      break;
    case 'level-ball':
      keys.add('playerLevel');
      break;
    case 'love-ball':
      keys.add('loveMatch');
      break;
  }
  if (gen >= 5) keys.add('speciesCaught');
  if (gen === 5) keys.add('darkGrass');
  if (captureBonusOptions(gen).length > 0) keys.add('captureBonus');
  if (gen >= 8) keys.add('catchingCharm');
  if (gen === 8) keys.add('underLevelPenalty');
  if (gen === 9) keys.add('badges').add('catchingPower').add('offGuard');
  return keys;
}

/** `47.28`, `100`, `<0.01` (percent, two decimals). */
export function formatChance(probability: number): string {
  if (probability >= 1) return '100';
  if (probability > 0 && probability < 0.0001) return '<0.01';
  return (Math.floor(probability * 10000) / 100).toFixed(2);
}

/** Average number of throws to catch it (null when it cannot be caught). */
export function expectedThrows(probability: number): number | null {
  return probability > 0 ? 1 / probability : null;
}
