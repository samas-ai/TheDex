import { sql, type SQL } from 'drizzle-orm';
import { stripProseMarkup } from '../prose';
import { pickI18n, sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';
import type { NamedEntity } from './catalog';
import { latestFlavorText } from './flavor';
import { machineLabel } from './learnset';
import { pokemonName } from './pokemon';

/**
 * Item Dex groups (RF05.1), in display order (items.app_group, derived by the pipeline from
 * PokeAPI categories). `held` covers held items and in-battle items (X items, flutes).
 */
export const ITEM_GROUPS = [
  'held',
  'berry',
  'machine',
  'medicine',
  'ball',
  'evolution',
  'treasure',
  'key',
  'other',
] as const;
export type ItemGroup = (typeof ITEM_GROUPS)[number];

export function isItemGroup(value: unknown): value is ItemGroup {
  return typeof value === 'string' && (ITEM_GROUPS as readonly string[]).includes(value);
}

export interface ItemFilters {
  /** Groups to list (any); all when empty. */
  readonly groups?: readonly ItemGroup[];
  /**
   * Only items of the context game: TMs/HMs/TRs it assigns a move to, other items present in
   * its generation's games (PokeAPI item_game_indices).
   */
  readonly inGameOnly?: boolean;
}

/** A move taught by a machine item in the context game. */
export interface MachineMove {
  readonly id: number;
  readonly name: string;
  readonly type: string | null;
}

export interface ItemListEntry extends NamedEntity {
  readonly group: ItemGroup;
  /** PokeAPI category identifier (healing, mega-stones…). */
  readonly category: string;
  /** Buy price (null/0 = cannot be bought). */
  readonly cost: number | null;
  /** For TMs/HMs/TRs: the move taught in the context game. */
  readonly machineMove: MachineMove | null;
}

const GROUP_ORDER = sql.raw(
  `CASE i.app_group ${ITEM_GROUPS.map((group, index) => `WHEN '${group}' THEN ${index}`).join(' ')} ELSE ${ITEM_GROUPS.length} END`,
);

/** Machine row of an item in the context game's version groups (alias `mc`). */
function machineOf(ctx: GameContext, itemId: SQL, column: string): SQL {
  return sql`(SELECT ${sql.raw(column)} FROM machines mc
    WHERE mc.item_id = ${itemId} AND mc.version_group_id IN (${sqlList(ctx.versionGroupIds)})
    ORDER BY mc.version_group_id LIMIT 1)`;
}

/** Item Dex list (RF05.1): items by group, TMs in machine-number order, others by name. */
export async function listItems(
  db: AnySQLiteDatabase,
  ctx: GameContext,
  filters: ItemFilters = {},
): Promise<ItemListEntry[]> {
  const { langChain } = ctx;
  const where: SQL[] = [sql`1 = 1`];
  if (filters.groups?.length) where.push(sql`i.app_group IN (${sqlList(filters.groups)})`);
  if (filters.inGameOnly) {
    where.push(sql`CASE WHEN i.app_group = 'machine'
      THEN EXISTS (SELECT 1 FROM machines mc WHERE mc.item_id = i.id
                   AND mc.version_group_id IN (${sqlList(ctx.versionGroupIds)}))
      ELSE EXISTS (SELECT 1 FROM item_generations ig
                   WHERE ig.item_id = i.id AND ig.generation_id = ${ctx.generationId}) END`);
  }
  const baseVg = ctx.versionGroupIds[0] ?? 0;
  const rows = (await db.all(sql`
    SELECT x.id, x.identifier, x.name, x.app_group, x.category, x.cost, x.machine_number, x.move_id,
      COALESCE(${pickI18n('move_i18n', 'move_id', sql`x.move_id`, 'name', langChain)},
               (SELECT identifier FROM moves m WHERE m.id = x.move_id)) AS move_name,
      (SELECT t.identifier FROM move_stats_by_vg ms JOIN types t ON t.id = ms.type_id
       WHERE ms.move_id = x.move_id AND ms.version_group_id = ${baseVg}) AS move_type
    FROM (
      SELECT i.id, i.identifier, i.app_group, c.identifier AS category, i.cost, ${GROUP_ORDER} AS group_order,
        COALESCE(${pickI18n('item_i18n', 'item_id', sql`i.id`, 'name', langChain)}, i.identifier) AS name,
        CASE WHEN i.app_group = 'machine' THEN ${machineOf(ctx, sql`i.id`, 'mc.machine_number')} END AS machine_number,
        CASE WHEN i.app_group = 'machine' THEN ${machineOf(ctx, sql`i.id`, 'mc.move_id')} END AS move_id
      FROM items i JOIN item_categories c ON c.id = i.category_id
      WHERE ${sql.join(where, sql` AND `)}
    ) x
    ORDER BY group_order, machine_number IS NULL, machine_number, name COLLATE NOCASE, id`)) as {
    id: number;
    identifier: string;
    name: string;
    app_group: ItemGroup;
    category: string;
    cost: number | null;
    machine_number: number | null;
    move_id: number | null;
    move_name: string | null;
    move_type: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    identifier: row.identifier,
    name: row.name,
    group: row.app_group,
    category: row.category,
    cost: row.cost,
    machineMove:
      row.move_id === null
        ? null
        : { id: row.move_id, name: row.move_name ?? String(row.move_id), type: row.move_type },
  }));
}

// --- Detail (RF05.2) ------------------------------------------------------------------------

export interface BerryInfo {
  readonly firmness: NamedEntity | null;
  readonly naturalGiftPower: number | null;
  readonly naturalGiftType: string | null;
  /** Size in millimetres. */
  readonly size: number | null;
  readonly maxHarvest: number | null;
  /** Hours per growth stage (Gen 4). */
  readonly growthTime: number | null;
  readonly soilDryness: number | null;
  readonly smoothness: number | null;
  /** Flavors with a potency above zero, strongest first. */
  readonly flavors: readonly { readonly flavor: NamedEntity; readonly potency: number }[];
}

export interface ItemPokemonRef {
  readonly pokemonId: number;
  readonly name: string;
}

export interface ItemDetail extends NamedEntity {
  readonly group: ItemGroup;
  readonly category: NamedEntity;
  readonly pocket: NamedEntity;
  /** Buy price; sell price is half (null/0 = cannot be bought). */
  readonly cost: number | null;
  readonly flingPower: number | null;
  readonly flingEffect: string | null;
  readonly shortEffect: string | null;
  readonly effect: string | null;
  readonly flavorText: string | null;
  /** Bag behaviour (consumable, holdable…) as localized descriptions. */
  readonly flags: readonly { readonly identifier: string; readonly description: string }[];
  /** Whether the item exists in the context game's generation. */
  readonly inGame: boolean;
  /** For TMs/HMs/TRs: label and move in the context game. */
  readonly machine: { readonly label: string; readonly move: MachineMove } | null;
  readonly berry: BerryInfo | null;
  /** Species evolving by using or holding the item (any game), as their default variety. */
  readonly evolutions: readonly (ItemPokemonRef & { readonly held: boolean })[];
  /** Varieties the item turns a Pokémon into (Mega Stones, orbs, plates, masks…). */
  readonly formChanges: readonly (ItemPokemonRef & { readonly from: ItemPokemonRef })[];
  /** Z-Moves unlocked by a Z-Crystal. */
  readonly zMoves: readonly NamedEntity[];
  /** Where to find it (RF05.2) — curated item_locations, still empty (CLAUDE.md, gaps). */
  readonly locations: readonly {
    readonly locationId: number | null;
    readonly name: string | null;
    readonly notes: string | null;
  }[];
}

const strip = (text: string | null) => (text === null ? null : stripProseMarkup(text));

async function berryInfo(
  db: AnySQLiteDatabase,
  itemId: number,
  langChain: readonly string[],
): Promise<BerryInfo | null> {
  const row = (await db.get(sql`
    SELECT b.id, b.natural_gift_power, t.identifier AS natural_gift_type, b.size, b.max_harvest,
      b.growth_time, b.soil_dryness, b.smoothness, f.id AS firmness_id, f.identifier AS firmness,
      ${pickI18n('berry_firmness_i18n', 'firmness_id', sql`f.id`, 'name', langChain)} AS firmness_name
    FROM berries b
    LEFT JOIN types t ON t.id = b.natural_gift_type_id
    LEFT JOIN berry_firmness f ON f.id = b.firmness_id
    WHERE b.item_id = ${itemId}`)) as
    | {
        id: number;
        natural_gift_power: number | null;
        natural_gift_type: string | null;
        size: number | null;
        max_harvest: number | null;
        growth_time: number | null;
        soil_dryness: number | null;
        smoothness: number | null;
        firmness_id: number | null;
        firmness: string | null;
        firmness_name: string | null;
      }
    | undefined;
  if (!row) return null;
  const flavors = (await db.all(sql`
    SELECT f.id, f.identifier, m.potency,
      ${pickI18n('flavor_i18n', 'flavor_id', sql`f.id`, 'name', langChain)} AS name
    FROM berry_flavor_map m JOIN flavors f ON f.id = m.flavor_id
    WHERE m.berry_id = ${row.id} AND m.potency > 0
    ORDER BY m.potency DESC, f.id`)) as {
    id: number;
    identifier: string;
    potency: number;
    name: string | null;
  }[];
  return {
    firmness:
      row.firmness_id === null || row.firmness === null
        ? null
        : {
            id: row.firmness_id,
            identifier: row.firmness,
            name: row.firmness_name ?? row.firmness,
          },
    naturalGiftPower: row.natural_gift_power,
    naturalGiftType: row.natural_gift_type,
    size: row.size,
    maxHarvest: row.max_harvest,
    growthTime: row.growth_time,
    soilDryness: row.soil_dryness,
    smoothness: row.smoothness,
    flavors: flavors.map((flavor) => ({
      flavor: {
        id: flavor.id,
        identifier: flavor.identifier,
        name: flavor.name ?? flavor.identifier,
      },
      potency: flavor.potency,
    })),
  };
}

/** Item detail (RF05.2) resolved for the context game. */
export async function getItemDetail(
  db: AnySQLiteDatabase,
  itemId: number,
  ctx: GameContext,
): Promise<ItemDetail | null> {
  const { langChain } = ctx;
  const row = (await db.get(sql`
    SELECT i.id, i.identifier, i.app_group, i.cost, i.fling_power,
      COALESCE(${pickI18n('item_i18n', 'item_id', sql`i.id`, 'name', langChain)}, i.identifier) AS name,
      ${pickI18n('item_prose_i18n', 'item_id', sql`i.id`, 'short_effect', langChain)} AS short_effect,
      ${pickI18n('item_prose_i18n', 'item_id', sql`i.id`, 'effect', langChain)} AS effect,
      ${pickI18n('item_fling_effect_i18n', 'fling_effect_id', sql`i.fling_effect_id`, 'effect', langChain)} AS fling_effect,
      c.id AS category_id, c.identifier AS category,
      ${pickI18n('item_category_i18n', 'category_id', sql`c.id`, 'name', langChain)} AS category_name,
      p.id AS pocket_id, p.identifier AS pocket,
      ${pickI18n('item_pocket_i18n', 'pocket_id', sql`p.id`, 'name', langChain)} AS pocket_name,
      EXISTS (SELECT 1 FROM item_generations ig
              WHERE ig.item_id = i.id AND ig.generation_id = ${ctx.generationId}) AS in_generation,
      ${machineOf(ctx, sql`i.id`, 'mc.move_id')} AS machine_move_id
    FROM items i
    JOIN item_categories c ON c.id = i.category_id
    JOIN item_pockets p ON p.id = c.pocket_id
    WHERE i.id = ${itemId}`)) as
    | {
        id: number;
        identifier: string;
        app_group: ItemGroup;
        cost: number | null;
        fling_power: number | null;
        name: string;
        short_effect: string | null;
        effect: string | null;
        fling_effect: string | null;
        category_id: number;
        category: string;
        category_name: string | null;
        pocket_id: number;
        pocket: string;
        pocket_name: string | null;
        in_generation: number;
        machine_move_id: number | null;
      }
    | undefined;
  if (!row) return null;

  const flags = (await db.all(sql`
    SELECT f.identifier,
      ${pickI18n('item_flag_i18n', 'flag_id', sql`f.id`, 'description', langChain)} AS description,
      ${pickI18n('item_flag_i18n', 'flag_id', sql`f.id`, 'name', langChain)} AS name
    FROM item_flag_map m JOIN item_flags f ON f.id = m.flag_id
    WHERE m.item_id = ${itemId} ORDER BY f.id`)) as {
    identifier: string;
    description: string | null;
    name: string | null;
  }[];

  let machine: ItemDetail['machine'] = null;
  if (row.machine_move_id !== null) {
    const move = (await db.get(sql`
      SELECT COALESCE(${pickI18n('move_i18n', 'move_id', sql`m.id`, 'name', langChain)}, m.identifier) AS name,
        (SELECT t.identifier FROM move_stats_by_vg ms JOIN types t ON t.id = ms.type_id
         WHERE ms.move_id = m.id AND ms.version_group_id IN (${sqlList(ctx.versionGroupIds)})
         LIMIT 1) AS type
      FROM moves m WHERE m.id = ${row.machine_move_id}`)) as { name: string; type: string | null };
    machine = {
      label: machineLabel(row.identifier),
      move: { id: row.machine_move_id, name: move.name, type: move.type },
    };
  }

  const evolutions = (await db.all(sql`
    SELECT p.id, ${pokemonName(sql`p.id`, langChain)} AS name, max(pe.held_item_id = ${itemId}) AS held
    FROM pokemon_evolution pe
    JOIN pokemon p ON p.species_id = pe.evolved_species_id AND p.is_default = 1
    WHERE pe.trigger_item_id = ${itemId} OR pe.held_item_id = ${itemId}
    GROUP BY p.id ORDER BY p.species_id`)) as { id: number; name: string; held: number }[];

  const formChanges = (await db.all(sql`
    SELECT p.id, ${pokemonName(sql`p.id`, langChain)} AS name, fc.from_pokemon_id,
      (SELECT ${pokemonName(sql`p.id`, langChain)} FROM pokemon p WHERE p.id = fc.from_pokemon_id) AS from_name
    FROM form_changes fc JOIN pokemon p ON p.id = fc.to_pokemon_id
    WHERE fc.item_id = ${itemId} ORDER BY p.species_id, p.id`)) as {
    id: number;
    name: string;
    from_pokemon_id: number;
    from_name: string;
  }[];

  const zMoves = (await db.all(sql`
    SELECT DISTINCT v.id, v.identifier,
      COALESCE(${pickI18n('move_i18n', 'move_id', sql`v.id`, 'name', langChain)}, v.identifier) AS name
    FROM move_variants mv JOIN moves v ON v.id = mv.variant_move_id
    WHERE mv.required_item_id IN (
      SELECT id FROM items WHERE id = ${itemId} OR (ps_id IS NOT NULL
        AND ps_id = (SELECT ps_id FROM items WHERE id = ${itemId})))
    ORDER BY v.id`)) as { id: number; identifier: string; name: string }[];

  const locations = (await db.all(sql`
    SELECT il.location_area_id, il.notes,
      (SELECT ${pickI18n('location_i18n', 'location_id', sql`la.location_id`, 'name', langChain)}
       FROM location_areas la WHERE la.id = il.location_area_id) AS name,
      (SELECT location_id FROM location_areas la WHERE la.id = il.location_area_id) AS location_id
    FROM item_locations il WHERE il.item_id = ${itemId} AND il.game_id = ${ctx.gameId}
    ORDER BY il.id`)) as {
    location_area_id: number | null;
    notes: string | null;
    name: string | null;
    location_id: number | null;
  }[];

  return {
    id: row.id,
    identifier: row.identifier,
    name: row.name,
    group: row.app_group,
    category: {
      id: row.category_id,
      identifier: row.category,
      name: row.category_name ?? row.category,
    },
    pocket: { id: row.pocket_id, identifier: row.pocket, name: row.pocket_name ?? row.pocket },
    cost: row.cost,
    flingPower: row.fling_power,
    flingEffect: strip(row.fling_effect),
    // A TM's prose and descriptions name the move of some other game: `machine` replaces them.
    shortEffect: row.app_group === 'machine' ? null : strip(row.short_effect),
    effect: row.app_group === 'machine' ? null : strip(row.effect),
    flavorText:
      row.app_group === 'machine'
        ? null
        : await latestFlavorText(db, 'item_flavor_text', itemId, ctx),
    flags: flags.map((flag) => ({
      identifier: flag.identifier,
      description: flag.description ?? flag.name ?? flag.identifier,
    })),
    inGame: row.in_generation === 1 || machine !== null,
    machine,
    berry: row.app_group === 'berry' ? await berryInfo(db, itemId, langChain) : null,
    evolutions: evolutions.map((evolution) => ({
      pokemonId: evolution.id,
      name: evolution.name,
      held: evolution.held === 1,
    })),
    formChanges: formChanges.map((change) => ({
      pokemonId: change.id,
      name: change.name,
      from: { pokemonId: change.from_pokemon_id, name: change.from_name },
    })),
    zMoves,
    locations: locations.map((location) => ({
      locationId: location.location_id,
      name: location.name,
      notes: location.notes,
    })),
  };
}
