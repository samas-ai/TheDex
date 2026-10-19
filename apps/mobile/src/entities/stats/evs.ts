import {
  SHOWDOWN_STATS,
  showdownEvLimits,
  type Generation,
  type ShowdownStat,
  type StatsTable,
} from '@thedex/engine';

/** Sum of an EV spread (Showdown's 0–255 scale: team builder RF08.2, stat calculator RF11.1). */
export function evTotal(evs: StatsTable): number {
  return SHOWDOWN_STATS.reduce((sum, stat) => sum + evs[stat], 0);
}

/**
 * Sets one EV, clamped to the generation's per-stat cap and to what the 510 total leaves
 * (Gen 3+). Non-integers round down.
 */
export function setEv(
  evs: StatsTable,
  stat: ShowdownStat,
  value: number,
  gen: Generation,
): StatsTable {
  const limits = showdownEvLimits(gen);
  let next = Math.max(0, Math.min(limits.perStat, Math.floor(value)));
  if (limits.total !== null) {
    next = Math.min(next, limits.total - (evTotal(evs) - evs[stat]));
  }
  return { ...evs, [stat]: Math.max(0, next) };
}

/** EVs within the generation's caps (imports may break them). */
export function evsValid(evs: StatsTable, gen: Generation): boolean {
  const limits = showdownEvLimits(gen);
  return (
    SHOWDOWN_STATS.every((stat) => evs[stat] <= limits.perStat) &&
    (limits.total === null || evTotal(evs) <= limits.total)
  );
}
