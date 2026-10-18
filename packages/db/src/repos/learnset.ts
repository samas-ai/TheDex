import { sql } from 'drizzle-orm';
import { pickI18n, sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';

/**
 * Moveset tabs (RF02.6). `evolution` = level-up at level 0 in Gen 7+ (moves learned on
 * evolving); methods outside the five tabs are grouped as `other` with their identifier.
 */
export type LearnTab = 'level-up' | 'evolution' | 'machine' | 'egg' | 'tutor' | 'other';

export interface LearnsetMove {
  readonly tab: LearnTab;
  /** PokeAPI learn method identifier (level-up, machine, egg, tutor, form-change…). */
  readonly method: string;
  readonly level: number;
  readonly moveId: number;
  readonly identifier: string;
  readonly name: string;
  /** Move data in the version group the row comes from (base game first). */
  readonly type: string | null;
  readonly damageClass: string | null;
  readonly power: number | null;
  readonly accuracy: number | null;
  readonly pp: number | null;
  /** TM/HM/TR label in that version group (e.g. `TM24`, `HM03`, `TR12`). */
  readonly machine: string | null;
}

export interface PokemonLearnset {
  readonly moves: readonly LearnsetMove[];
  /**
   * Set when the variety has no learnset of its own (Mega, G-Max, battle forms) and the
   * moves come from the variety it changes from (or the species' default variety).
   */
  readonly inheritedFromPokemonId: number | null;
}

/** Display label of a machine item identifier (`tm24` → `TM24`, `hm03` → `HM03`). */
export function machineLabel(identifier: string): string {
  return identifier.toUpperCase();
}

const TABS: Readonly<Record<string, LearnTab>> = {
  'level-up': 'level-up',
  machine: 'machine',
  egg: 'egg',
  tutor: 'tutor',
};

/** Tab of a learnset row; `level` 0 level-up moves are learned on evolving from Gen 7 on. */
export function tabOf(method: string, level: number, generationId: number): LearnTab {
  if (method === 'level-up' && level === 0 && generationId >= 7) return 'evolution';
  return TABS[method] ?? 'other';
}

async function learnsetRows(db: AnySQLiteDatabase, pokemonId: number, ctx: GameContext) {
  return (await db.all(sql`
    SELECT m.identifier AS method, pm.level, pm.move_id, mv.identifier,
      ${pickI18n('move_i18n', 'move_id', sql`pm.move_id`, 'name', ctx.langChain)} AS name,
      min(pm.version_group_id) AS version_group_id,
      t.identifier AS type, dc.identifier AS damage_class, ms.power, ms.accuracy, ms.pp,
      (SELECT i.identifier FROM machines mc JOIN items i ON i.id = mc.item_id
       WHERE mc.move_id = pm.move_id AND mc.version_group_id = pm.version_group_id
       ORDER BY mc.machine_number LIMIT 1) AS machine
    FROM pokemon_moves pm
    JOIN move_learn_methods m ON m.id = pm.method_id
    JOIN moves mv ON mv.id = pm.move_id
    LEFT JOIN move_stats_by_vg ms ON ms.move_id = pm.move_id AND ms.version_group_id = pm.version_group_id
    LEFT JOIN types t ON t.id = ms.type_id
    LEFT JOIN move_damage_classes dc ON dc.id = ms.damage_class_id
    WHERE pm.pokemon_id = ${pokemonId} AND pm.version_group_id IN (${sqlList(ctx.versionGroupIds)})
    GROUP BY pm.method_id, pm.move_id, pm.level
    ORDER BY pm.method_id, pm.level, name`)) as {
    method: string;
    level: number;
    move_id: number;
    identifier: string;
    name: string | null;
    type: string | null;
    damage_class: string | null;
    power: number | null;
    accuracy: number | null;
    pp: number | null;
    machine: string | null;
  }[];
}

/** Every move the variety learns in the context game, merging DLC version groups. */
export async function getPokemonMoves(
  db: AnySQLiteDatabase,
  pokemonId: number,
  ctx: GameContext,
): Promise<PokemonLearnset> {
  let rows = await learnsetRows(db, pokemonId, ctx);
  let inheritedFromPokemonId: number | null = null;
  if (rows.length === 0) {
    const base = (await db.get(sql`
      SELECT COALESCE(
        (SELECT from_pokemon_id FROM form_changes WHERE to_pokemon_id = p.id LIMIT 1),
        (SELECT d.id FROM pokemon d WHERE d.species_id = p.species_id AND d.is_default = 1)
      ) AS base_id
      FROM pokemon p WHERE p.id = ${pokemonId} AND p.is_default = 0`)) as
      { base_id: number | null } | undefined;
    if (base?.base_id != null && base.base_id !== pokemonId) {
      rows = await learnsetRows(db, base.base_id, ctx);
      inheritedFromPokemonId = rows.length > 0 ? base.base_id : null;
    }
  }
  return {
    inheritedFromPokemonId,
    moves: rows.map((row) => ({
      tab: tabOf(row.method, row.level, ctx.generationId),
      method: row.method,
      level: row.level,
      moveId: row.move_id,
      identifier: row.identifier,
      name: row.name ?? row.identifier,
      type: row.type,
      damageClass: row.damage_class,
      power: row.power,
      accuracy: row.accuracy,
      pp: row.pp,
      machine: row.machine ? machineLabel(row.machine) : null,
    })),
  };
}
