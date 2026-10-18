import type { LearnTab, MoveLearner, MoveMeta } from '@thedex/db';

/** Minimal translate function (react-i18next's `t` fits). */
export type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Power / accuracy / PP cell: `—` when the move has none (status moves, never-miss moves). */
export function formatMoveValue(value: number | null): string {
  return value === null ? '—' : String(value);
}

/** Priority with its sign: `+1`, `0`, `−3`. */
export function formatPriority(priority: number): string {
  if (priority > 0) return `+${priority}`;
  if (priority < 0) return `−${-priority}`;
  return '0';
}

/** `+1`, `−2` stat stages. */
export function formatStages(stages: number): string {
  return stages > 0 ? `+${stages}` : `−${-stages}`;
}

/**
 * Battle details of a move (RF03.2) as sentences: multi-hit, multi-turn, drain/recoil,
 * healing, critical-hit stage, status/flinch chances and stat changes.
 */
export function describeMoveMeta(
  meta: MoveMeta,
  t: Translate,
  statName: (identifier: string) => string,
): string[] {
  const k = (key: string, options?: Record<string, unknown>) => t(`move.meta.${key}`, options);
  const range = (min: number, max: number) => (min === max ? String(min) : `${min}–${max}`);
  const lines: string[] = [];
  if (meta.minHits !== null && meta.maxHits !== null) {
    lines.push(k('hits', { count: range(meta.minHits, meta.maxHits) }));
  }
  if (meta.minTurns !== null && meta.maxTurns !== null) {
    lines.push(k('turns', { count: range(meta.minTurns, meta.maxTurns) }));
  }
  if (meta.drain > 0) lines.push(k('drain', { value: meta.drain }));
  if (meta.drain < 0) lines.push(k('recoil', { value: -meta.drain }));
  if (meta.healing > 0) lines.push(k('healing', { value: meta.healing }));
  if (meta.healing < 0) lines.push(k('hpCost', { value: -meta.healing }));
  if (meta.critRate > 0) lines.push(k('crit', { value: meta.critRate }));
  if (meta.ailment) {
    lines.push(
      meta.ailmentChance > 0
        ? k('ailmentChance', { chance: meta.ailmentChance, ailment: meta.ailment.name })
        : k('ailment', { ailment: meta.ailment.name }),
    );
  }
  if (meta.flinchChance > 0) lines.push(k('flinch', { chance: meta.flinchChance }));
  if (meta.statChanges.length > 0) {
    const changes = meta.statChanges
      .map((change) => `${statName(change.stat)} ${formatStages(change.change)}`)
      .join(', ');
    lines.push(
      meta.statChance > 0
        ? k('statChanceChanges', { chance: meta.statChance, changes })
        : k('statChanges', { changes }),
    );
  }
  return lines;
}

/** Z-Move stat boosts of a status move, e.g. `Speed +1`. */
export function describeZBoosts(
  boosts: Readonly<Record<string, number>> | null,
  statName: (identifier: string) => string,
): string | null {
  if (!boosts) return null;
  const entries = Object.entries(boosts);
  if (entries.length === 0) return null;
  return entries.map(([stat, stages]) => `${statName(stat)} ${formatStages(stages)}`).join(', ');
}

/** Learn tabs in display order (same as the profile's moveset, RF02.6). */
export const LEARNER_TABS: readonly LearnTab[] = [
  'level-up',
  'evolution',
  'machine',
  'egg',
  'tutor',
  'other',
];

export interface LearnerEntry {
  readonly learner: MoveLearner;
  /** Levels at which it is learned (level-up tab only; empty elsewhere). */
  readonly levels: readonly number[];
}

/**
 * Learners of a move split by learn method (RF03.3): a Pokémon appears once per method it
 * uses. Level-up learners are sorted by their first level; empty tabs are dropped.
 */
export function learnersByTab(learners: readonly MoveLearner[]): [LearnTab, LearnerEntry[]][] {
  return LEARNER_TABS.map((tab): [LearnTab, LearnerEntry[]] => {
    const entries = learners
      .filter((learner) => learner.methods.some((method) => method.tab === tab))
      .map((learner) => ({
        learner,
        levels:
          tab === 'level-up'
            ? [
                ...new Set(
                  learner.methods.filter((m) => m.tab === tab).map((method) => method.level),
                ),
              ].sort((a, b) => a - b)
            : [],
      }));
    if (tab === 'level-up') {
      entries.sort((a, b) => (a.levels[0] ?? 0) - (b.levels[0] ?? 0));
    }
    return [tab, entries];
  }).filter(([, entries]) => entries.length > 0);
}
