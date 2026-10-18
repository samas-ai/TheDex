import {
  assertGeneration,
  defensiveMultipliers,
  isTypeName,
  statBounds,
  type CombinedMultiplier,
  type StatName,
  type TypeName,
} from '@thedex/engine';
import type {
  EvolutionMethod,
  EvolutionNode,
  LearnsetMove,
  LearnTab,
  PokemonStats,
} from '@thedex/db';

// --- Base stats (RF02.4) -------------------------------------------------------------------

export interface StatRow {
  readonly stat: StatName;
  readonly base: number;
  readonly lv50: { readonly min: number; readonly max: number };
  readonly lv100: { readonly min: number; readonly max: number };
}

/**
 * Rows of the stats table for the context generation: Gen 1 shows the unified Special,
 * later generations Sp. Atk / Sp. Def. Ranges come from the engine's in-game formulas.
 */
export function statRows(stats: PokemonStats, generationId: number): StatRow[] {
  const gen = assertGeneration(generationId);
  const entries: [StatName, number][] =
    gen === 1
      ? [
          ['hp', stats.hp],
          ['attack', stats.attack],
          ['defense', stats.defense],
          ['special', stats.special ?? stats.specialAttack],
          ['speed', stats.speed],
        ]
      : [
          ['hp', stats.hp],
          ['attack', stats.attack],
          ['defense', stats.defense],
          ['special-attack', stats.specialAttack],
          ['special-defense', stats.specialDefense],
          ['speed', stats.speed],
        ];
  return entries.map(([stat, base]) => {
    const at = (level: number) => {
      const bounds = statBounds({ gen, stat, base, level });
      return { min: bounds.min, max: bounds.max };
    };
    return { stat, base, lv50: at(50), lv100: at(100) };
  });
}

// --- Defensive matchups (RF02.3) -------------------------------------------------------------

export const MULTIPLIER_ORDER: readonly CombinedMultiplier[] = [4, 2, 1, 0.5, 0.25, 0];

export interface MatchupGroup {
  readonly multiplier: CombinedMultiplier;
  readonly types: readonly TypeName[];
}

/** Attacking types grouped by the damage multiplier they deal to this typing in `gen`. */
export function defensiveGroups(types: readonly string[], generationId: number): MatchupGroup[] {
  const gen = assertGeneration(generationId);
  const defending = types.filter(isTypeName);
  if (defending.length === 0) return [];
  const multipliers = defensiveMultipliers(defending, gen);
  return MULTIPLIER_ORDER.map((multiplier) => ({
    multiplier,
    types: (Object.entries(multipliers) as [TypeName, CombinedMultiplier][])
      .filter(([, value]) => value === multiplier)
      .map(([type]) => type),
  })).filter((group) => group.types.length > 0);
}

/** `×4`, `×½`, `×¼`, `×0`. */
export function multiplierLabel(multiplier: CombinedMultiplier): string {
  if (multiplier === 0.5) return '×½';
  if (multiplier === 0.25) return '×¼';
  return `×${multiplier}`;
}

// --- Evolution (RF02.5) ------------------------------------------------------------------------

/** Minimal translate function (react-i18next's `t` fits). */
export type Translate = (key: string, options?: Record<string, unknown>) => string;

const TIMES = new Set(['day', 'night', 'dusk', 'full-moon']);

/** Human description of one evolution method, e.g. "Lv. 16", "Use Water Stone, at night". */
export function describeEvolutionMethod(method: EvolutionMethod, t: Translate): string {
  const k = (key: string, options?: Record<string, unknown>) =>
    t(`profile.evolution.method.${key}`, options);
  const parts: string[] = [];

  switch (method.trigger) {
    case 'level-up':
      parts.push(method.minLevel !== null ? k('level', { level: method.minLevel }) : k('levelUp'));
      break;
    case 'trade':
      parts.push(k('trade'));
      if (method.tradeSpecies) parts.push(k('tradeFor', { species: method.tradeSpecies.name }));
      break;
    case 'use-item':
      parts.push(k('useItem', { item: method.item?.name ?? '?' }));
      break;
    default:
      parts.push(method.triggerName);
      if (method.minLevel !== null) parts.push(k('level', { level: method.minLevel }));
  }
  if (method.trigger !== 'use-item' && method.item) {
    parts.push(k('useItem', { item: method.item.name }));
  }
  if (method.heldItem) parts.push(k('holding', { item: method.heldItem.name }));
  if (method.minHappiness !== null) parts.push(k('friendship', { value: method.minHappiness }));
  if (method.minAffection !== null) parts.push(k('affection', { value: method.minAffection }));
  if (method.minBeauty !== null) parts.push(k('beauty', { value: method.minBeauty }));
  if (method.knownMove) parts.push(k('knownMove', { move: method.knownMove.name }));
  if (method.knownMoveType) parts.push(k('knownMoveType', { type: method.knownMoveType.name }));
  if (method.location) parts.push(k('at', { location: method.location.name }));
  if (method.nearSpecialRock && !method.location) parts.push(k('nearRock'));
  if (method.timeOfDay && TIMES.has(method.timeOfDay)) {
    parts.push(k(`timeOfDay.${method.timeOfDay}`));
  }
  if (method.gender) parts.push(k(method.gender));
  if (method.needsOverworldRain) parts.push(k('rain'));
  if (method.turnUpsideDown) parts.push(k('upsideDown'));
  if (method.needsMultiplayer) parts.push(k('multiplayer'));
  if (method.partySpecies) parts.push(k('partySpecies', { species: method.partySpecies.name }));
  if (method.partyType) parts.push(k('partyType', { type: method.partyType.name }));
  if (method.relativePhysicalStats === 1) parts.push(k('atkGtDef'));
  if (method.relativePhysicalStats === 0) parts.push(k('atkEqDef'));
  if (method.relativePhysicalStats === -1) parts.push(k('atkLtDef'));
  if (method.usedMove) {
    parts.push(k('usedMove', { move: method.usedMove.name, count: method.minMoveCount ?? 1 }));
  }
  if (method.minSteps !== null) parts.push(k('steps', { count: method.minSteps }));
  if (method.minDamageTaken !== null)
    parts.push(k('damageTaken', { count: method.minDamageTaken }));
  if (method.region) parts.push(k('region', { region: method.region.name }));
  if (method.evolvedPokemon) parts.push(k('becomes', { name: method.evolvedPokemon.name }));
  return parts.join(', ');
}

/** Evolution stages left to right: roots, their evolutions, and so on (branches share a stage). */
export function evolutionStages(nodes: readonly EvolutionNode[]): EvolutionNode[][] {
  const depth = new Map<number, number>();
  for (const node of nodes) {
    const parent = node.evolvesFromSpeciesId;
    depth.set(node.speciesId, parent === null ? 0 : (depth.get(parent) ?? 0) + 1);
  }
  const stages: EvolutionNode[][] = [];
  for (const node of nodes) (stages[depth.get(node.speciesId) ?? 0] ??= []).push(node);
  return stages.filter((stage) => stage.length > 0);
}

// --- Moveset (RF02.6) --------------------------------------------------------------------------

export const LEARN_TABS: readonly LearnTab[] = [
  'level-up',
  'evolution',
  'machine',
  'egg',
  'tutor',
  'other',
];

/** Moves split by tab, empty tabs removed; machine moves sorted by TM number. */
export function movesByTab(moves: readonly LearnsetMove[]): [LearnTab, LearnsetMove[]][] {
  return LEARN_TABS.map((tab): [LearnTab, LearnsetMove[]] => {
    const list = moves.filter((move) => move.tab === tab);
    if (tab === 'machine') {
      list.sort((a, b) => {
        if (a.machine === null || b.machine === null) {
          return (a.machine === null ? 1 : 0) - (b.machine === null ? 1 : 0);
        }
        return a.machine.localeCompare(b.machine, 'en', { numeric: true });
      });
    }
    return [tab, list];
  }).filter(([, list]) => list.length > 0);
}
