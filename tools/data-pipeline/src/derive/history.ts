import { LATEST_GENERATION } from '@thedex/engine';
import type { BuildContext } from '../context';
import type { CsvRow } from '../csv';
import { toInt, toIntRequired, type SqlValue } from '../values';

const STAT_HP = 1;
const STAT_ATTACK = 2;
const STAT_DEFENSE = 3;
const STAT_SPECIAL_ATTACK = 4;
const STAT_SPECIAL_DEFENSE = 5;
const STAT_SPEED = 6;
const STAT_SPECIAL = 9;
const BATTLE_STATS = [
  STAT_HP,
  STAT_ATTACK,
  STAT_DEFENSE,
  STAT_SPECIAL_ATTACK,
  STAT_SPECIAL_DEFENSE,
  STAT_SPEED,
] as const;

/** Abilities exist from Gen 3; hidden abilities from Gen 5. */
const ABILITIES_SINCE = 3;
const HIDDEN_ABILITIES_SINCE = 5;

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/**
 * PokeAPI `*_past` semantics: a row with generation_id = G holds the value that applied up
 * to and including G. For generation `gen`, the applicable row is the one with the smallest
 * generation_id ≥ gen; when there is none, the current value applies.
 */
function applicablePast<T extends { gen: number }>(rows: readonly T[] | undefined, gen: number) {
  let best: T | undefined;
  for (const row of rows ?? []) {
    if (row.gen >= gen && (!best || row.gen < best.gen)) best = row;
  }
  return best;
}

interface PokemonInfo {
  id: number;
  introGen: number;
}

function pokemonIntroductions(ctx: BuildContext): PokemonInfo[] {
  const vgGeneration = new Map(
    ctx
      .all<{ id: number; generation_id: number }>('SELECT id, generation_id FROM version_groups')
      .map((row) => [row.id, row.generation_id]),
  );
  return ctx
    .all<{ id: number; is_default: number; species_gen: number; form_vg: number | null }>(
      `SELECT p.id, p.is_default, s.generation_id AS species_gen,
         (SELECT introduced_in_version_group_id FROM pokemon_forms f
           WHERE f.pokemon_id = p.id AND f.is_default = 1) AS form_vg
       FROM pokemon p JOIN pokemon_species s ON s.id = p.species_id`,
    )
    .map((row) => ({
      id: row.id,
      introGen:
        row.is_default === 1 || row.form_vg === null
          ? row.species_gen
          : (vgGeneration.get(row.form_vg) ?? row.species_gen),
    }));
}

function deriveTypes(ctx: BuildContext, pokemon: readonly PokemonInfo[]): number {
  const typeGeneration = new Map(
    ctx
      .all<{ id: number; generation_id: number }>('SELECT id, generation_id FROM types')
      .map((row) => [row.id, row.generation_id]),
  );
  const parse = (row: CsvRow) => ({
    pokemon: toIntRequired(row.pokemon_id),
    gen: toInt(row.generation_id) ?? 0,
    slot: toIntRequired(row.slot),
    type: toIntRequired(row.type_id),
  });
  const current = groupBy(ctx.csv('pokemon_types').map(parse), (r) => r.pokemon);
  const past = groupBy(ctx.csv('pokemon_types_past').map(parse), (r) => r.pokemon);

  const rows: SqlValue[][] = [];
  let anachronisms = 0;
  for (const { id, introGen } of pokemon) {
    const currentTypes = current.get(id) ?? [];
    const pastRows = past.get(id) ?? [];
    for (let gen = introGen; gen <= LATEST_GENERATION; gen++) {
      const applicable = applicablePast(pastRows, gen);
      const typing = applicable ? pastRows.filter((r) => r.gen === applicable.gen) : currentTypes;
      for (const entry of typing) {
        if ((typeGeneration.get(entry.type) ?? 1) > gen) anachronisms++;
        rows.push([id, gen, entry.slot, entry.type]);
      }
    }
  }
  if (anachronisms > 0) ctx.log(`  ! ${anachronisms} type rows predate their type's generation`);
  return ctx.insert(
    'pokemon_types_by_gen',
    ['pokemon_id', 'generation_id', 'slot', 'type_id'],
    rows,
  );
}

function deriveAbilities(ctx: BuildContext, pokemon: readonly PokemonInfo[]): number {
  const abilityGeneration = new Map(
    ctx
      .all<{ id: number; generation_id: number }>('SELECT id, generation_id FROM abilities')
      .map((row) => [row.id, row.generation_id]),
  );
  const parse = (row: CsvRow) => ({
    pokemon: toIntRequired(row.pokemon_id),
    gen: toInt(row.generation_id) ?? 0,
    slot: toIntRequired(row.slot),
    ability: toInt(row.ability_id),
    hidden: toInt(row.is_hidden) === 1,
  });
  const current = groupBy(ctx.csv('pokemon_abilities').map(parse), (r) => r.pokemon);
  const past = groupBy(ctx.csv('pokemon_abilities_past').map(parse), (r) => r.pokemon);

  const rows: SqlValue[][] = [];
  for (const { id, introGen } of pokemon) {
    const currentBySlot = current.get(id) ?? [];
    const pastBySlot = groupBy(past.get(id) ?? [], (r) => r.slot);
    const slots = new Set([...currentBySlot.map((r) => r.slot), ...pastBySlot.keys()]);
    for (let gen = Math.max(introGen, ABILITIES_SINCE); gen <= LATEST_GENERATION; gen++) {
      for (const slot of [...slots].sort()) {
        const override = applicablePast(pastBySlot.get(slot), gen);
        const entry = override ?? currentBySlot.find((r) => r.slot === slot);
        if (!entry || entry.ability === null) continue;
        if (entry.hidden && gen < HIDDEN_ABILITIES_SINCE) continue;
        if ((abilityGeneration.get(entry.ability) ?? 0) > gen) continue;
        rows.push([id, gen, slot, entry.ability, entry.hidden ? 1 : 0]);
      }
    }
  }
  return ctx.insert(
    'pokemon_abilities_by_gen',
    ['pokemon_id', 'generation_id', 'slot', 'ability_id', 'is_hidden'],
    rows,
  );
}

function deriveStats(ctx: BuildContext, pokemon: readonly PokemonInfo[]): number {
  const parse = (row: CsvRow) => ({
    pokemon: toIntRequired(row.pokemon_id),
    gen: toInt(row.generation_id) ?? 0,
    stat: toIntRequired(row.stat_id),
    base: toIntRequired(row.base_stat),
    effort: toInt(row.effort) ?? 0,
  });
  const current = groupBy(ctx.csv('pokemon_stats').map(parse), (r) => r.pokemon);
  const past = groupBy(ctx.csv('pokemon_stats_past').map(parse), (r) => r.pokemon);

  const rows: SqlValue[][] = [];
  let missing = 0;
  for (const { id, introGen } of pokemon) {
    const currentStats = new Map((current.get(id) ?? []).map((r) => [r.stat, r]));
    if (currentStats.size < BATTLE_STATS.length) {
      missing++;
      continue;
    }
    const pastByStat = groupBy(past.get(id) ?? [], (r) => r.stat);
    for (let gen = introGen; gen <= LATEST_GENERATION; gen++) {
      const resolved = BATTLE_STATS.map(
        (stat) => applicablePast(pastByStat.get(stat), gen) ?? currentStats.get(stat)!,
      );
      const [hp, attack, defense, spAttack, spDefense, speed] = resolved.map((r) => r.base) as [
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      const evs = resolved.map((r) => r.effort);
      let special: number | null = null;
      let spa = spAttack;
      let spd = spDefense;
      let bst = hp + attack + defense + spAttack + spDefense + speed;
      if (gen === 1) {
        // Gen 1 had a single Special stat (Showdown convention: SpA = SpD = Special).
        special = applicablePast(pastByStat.get(STAT_SPECIAL), gen)?.base ?? spAttack;
        spa = special;
        spd = special;
        bst = hp + attack + defense + special + speed;
      }
      rows.push([id, gen, hp, attack, defense, spa, spd, speed, special, bst, ...evs]);
    }
  }
  if (missing > 0) ctx.log(`  ! ${missing} pokemon without base stats skipped`);
  return ctx.insert(
    'pokemon_stats_by_gen',
    [
      'pokemon_id',
      'generation_id',
      'hp',
      'attack',
      'defense',
      'special_attack',
      'special_defense',
      'speed',
      'special',
      'bst',
      'ev_hp',
      'ev_attack',
      'ev_defense',
      'ev_special_attack',
      'ev_special_defense',
      'ev_speed',
    ],
    rows,
  );
}

/** Materializes per-generation typing, abilities and base stats from PokeAPI `*_past`. */
export function deriveHistory(ctx: BuildContext): void {
  const pokemon = pokemonIntroductions(ctx);
  ctx.log(`  pokemon_types_by_gen: ${deriveTypes(ctx, pokemon)}`);
  ctx.log(`  pokemon_abilities_by_gen: ${deriveAbilities(ctx, pokemon)}`);
  ctx.log(`  pokemon_stats_by_gen: ${deriveStats(ctx, pokemon)}`);
}
