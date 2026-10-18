import { sql, type SQL } from 'drizzle-orm';
import { stripProseMarkup } from '../prose';
import { pickI18n, sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';
import type { NamedEntity } from './catalog';
import { latestFlavorText } from './flavor';
import { machineLabel, tabOf, type LearnTab } from './learnset';
import { pokemonName } from './pokemon';

/** RF03.1 sort keys. */
export const MOVE_SORT_KEYS = [
  'name',
  'power',
  'accuracy',
  'pp',
  'priority',
  'generation',
] as const;
export type MoveSortKey = (typeof MOVE_SORT_KEYS)[number];

/** Move categories (PokeAPI damage classes). */
export const DAMAGE_CLASSES = ['physical', 'special', 'status'] as const;
export type DamageClass = (typeof DAMAGE_CLASSES)[number];

export interface MoveFilters {
  /** Move types (any). */
  readonly typeIds?: readonly number[];
  /** Categories as of the context game (any; Gens 1–3 derive it from the type). */
  readonly damageClasses?: readonly DamageClass[];
  /** Generations the move was introduced in (any). */
  readonly generationIds?: readonly number[];
  /** Only moves some Pokémon learns in the context game (RF03.1 "game" filter). */
  readonly learnableOnly?: boolean;
}

export interface MoveQuery {
  readonly filters?: MoveFilters;
  readonly sort?: { readonly key: MoveSortKey; readonly direction: 'asc' | 'desc' };
}

export interface MoveListEntry {
  readonly id: number;
  readonly identifier: string;
  readonly name: string;
  readonly generationId: number;
  /** Type identifier as of the context game. */
  readonly type: string;
  readonly damageClass: DamageClass;
  readonly power: number | null;
  /** Null = never misses. */
  readonly accuracy: number | null;
  readonly pp: number | null;
  readonly priority: number;
  /** `z` / `max` for Z-Moves and Max Moves, only listed in games with that mechanic. */
  readonly variantKind: string | null;
}

const SORT_COLUMNS: Readonly<Record<Exclude<MoveSortKey, 'name'>, string>> = {
  power: 'ms.power',
  accuracy: 'ms.accuracy',
  pp: 'ms.pp',
  priority: 'ms.priority',
  generation: 'm.generation_id',
};

function moveOrder(sort: NonNullable<MoveQuery['sort']>): SQL {
  const dir = sort.direction === 'desc' ? 'DESC' : 'ASC';
  if (sort.key === 'name') return sql.raw(`name COLLATE NOCASE ${dir}, m.id`);
  const column = SORT_COLUMNS[sort.key];
  return sql.raw(`${column} IS NULL, ${column} ${dir}, name COLLATE NOCASE, m.id`);
}

/** Version group whose move data stands for the context game (its base version group). */
function baseVersionGroup(ctx: GameContext): number {
  const base = ctx.versionGroupIds[0];
  if (base === undefined) throw new Error(`Game ${ctx.gameIdentifier} has no version group`);
  return base;
}

/**
 * Move Dex (RF03.1): moves that exist in the context game's generation with their data as of
 * that game, filtered by type, category, generation and learnability. Z-Moves and Max Moves
 * appear only in games with that mechanic.
 */
export async function listMoves(
  db: AnySQLiteDatabase,
  ctx: GameContext,
  query: MoveQuery = {},
): Promise<MoveListEntry[]> {
  const filters = query.filters ?? {};
  const where: SQL[] = [
    sql`ms.version_group_id = ${baseVersionGroup(ctx)}`,
    sql`(m.variant_kind IS NULL OR (m.variant_kind = 'z' AND g.has_z = 1)
      OR (m.variant_kind = 'max' AND g.has_dynamax = 1))`,
  ];
  if (filters.typeIds?.length) where.push(sql`ms.type_id IN (${sqlList(filters.typeIds)})`);
  if (filters.damageClasses?.length) {
    where.push(sql`dc.identifier IN (${sqlList(filters.damageClasses)})`);
  }
  if (filters.generationIds?.length) {
    where.push(sql`m.generation_id IN (${sqlList(filters.generationIds)})`);
  }
  if (filters.learnableOnly) {
    where.push(sql`EXISTS (SELECT 1 FROM pokemon_moves pm
      WHERE pm.move_id = m.id AND pm.version_group_id IN (${sqlList(ctx.versionGroupIds)}))`);
  }
  const rows = (await db.all(sql`
    SELECT m.id, m.identifier, m.generation_id, m.variant_kind,
      COALESCE(${pickI18n('move_i18n', 'move_id', sql`m.id`, 'name', ctx.langChain)}, m.identifier) AS name,
      t.identifier AS type, dc.identifier AS damage_class,
      ms.power, ms.accuracy, ms.pp, ms.priority
    FROM move_stats_by_vg ms
    JOIN moves m ON m.id = ms.move_id
    JOIN types t ON t.id = ms.type_id
    JOIN move_damage_classes dc ON dc.id = ms.damage_class_id
    JOIN games g ON g.id = ${ctx.gameId}
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY ${moveOrder(query.sort ?? { key: 'name', direction: 'asc' })}`)) as {
    id: number;
    identifier: string;
    generation_id: number;
    variant_kind: string | null;
    name: string;
    type: string;
    damage_class: DamageClass;
    power: number | null;
    accuracy: number | null;
    pp: number | null;
    priority: number;
  }[];
  return rows.map((row) => ({
    id: row.id,
    identifier: row.identifier,
    name: row.name,
    generationId: row.generation_id,
    type: row.type,
    damageClass: row.damage_class,
    power: row.power,
    accuracy: row.accuracy,
    pp: row.pp,
    priority: row.priority,
    variantKind: row.variant_kind,
  }));
}

// --- Detail (RF03.2, RF03.4) --------------------------------------------------------------

export interface MoveStats {
  /** Version group the data comes from (the game's, or the latest one with the move). */
  readonly versionGroupId: number;
  readonly type: string;
  readonly damageClass: DamageClass;
  readonly power: number | null;
  readonly accuracy: number | null;
  readonly pp: number | null;
  /** PP with three PP Ups (base × 1.6). */
  readonly maxPp: number | null;
  readonly priority: number;
  readonly target: {
    readonly identifier: string;
    readonly name: string;
    readonly description: string | null;
  };
  readonly effectChance: number | null;
}

export interface MoveMeta {
  /** PokeAPI meta category identifier (damage, ailment, net-good-stats, ohko…). */
  readonly category: string | null;
  /** Status condition the move can inflict (null when none). */
  readonly ailment: NamedEntity | null;
  readonly minHits: number | null;
  readonly maxHits: number | null;
  readonly minTurns: number | null;
  readonly maxTurns: number | null;
  /** HP drained (positive) or recoil (negative), % of damage dealt. */
  readonly drain: number;
  /** HP healed (positive) or lost, % of max HP. */
  readonly healing: number;
  /** Critical-hit stage bonus. */
  readonly critRate: number;
  readonly ailmentChance: number;
  readonly flinchChance: number;
  readonly statChance: number;
  readonly statChanges: readonly { readonly stat: string; readonly change: number }[];
}

export interface MoveFlag {
  readonly identifier: string;
  readonly name: string;
  readonly description: string | null;
}

/** What a move becomes as a Z-Move (RF03.4). */
export interface ZMoveInfo {
  /** Z-Move power of a damaging move. */
  readonly power: number | null;
  /** Z-effect of a status move (Showdown id: `clearnegativeboost`, `heal`, `crit2`…). */
  readonly effect: string | null;
  /** Stat stages a status move's Z-version raises, by stat identifier. */
  readonly boosts: Readonly<Record<string, number>> | null;
  /** The type's generic Z-Move and its Z-Crystal (damaging moves). */
  readonly move: NamedEntity | null;
  readonly crystal: NamedEntity | null;
  /** Exclusive Z-Moves built on this move (e.g. Thunderbolt → 10,000,000 Volt Thunderbolt). */
  readonly signatures: readonly {
    readonly move: NamedEntity;
    readonly crystal: NamedEntity | null;
    readonly pokemon: { readonly id: number; readonly name: string } | null;
  }[];
}

/** What a move becomes when Dynamaxed (RF03.4). */
export interface MaxMoveInfo {
  readonly power: number | null;
  /** The type's Max Move, or Max Guard for status moves. */
  readonly move: NamedEntity | null;
  /** G-Max Moves replacing that Max Move for specific Gigantamax Pokémon. */
  readonly gmax: readonly GmaxMove[];
}

export interface GmaxMove {
  readonly psId: string;
  /** English (Showdown) name — PokeAPI has no G-Max Moves. */
  readonly name: string;
  readonly type: string;
  readonly power: number | null;
  readonly description: string | null;
  readonly pokemon: { readonly id: number; readonly name: string } | null;
}

/** For a Z-Move or Max Move: what it is made from. */
export interface MoveVariantSource {
  /** z | z_signature | max */
  readonly kind: string;
  /** Type whose moves turn into it (generic Z-Moves and Max Moves). */
  readonly type: string | null;
  readonly baseMove: NamedEntity | null;
  readonly crystal: NamedEntity | null;
  readonly pokemon: { readonly id: number; readonly name: string } | null;
}

export interface MoveDetail {
  readonly id: number;
  readonly identifier: string;
  readonly name: string;
  readonly generationId: number;
  readonly variantKind: string | null;
  /** Whether the move exists in the context game's generation. */
  readonly inGame: boolean;
  /** Data as of the context game, else as of the latest game with the move. */
  readonly stats: MoveStats | null;
  /** Mechanics prose with `$effect_chance` filled in. */
  readonly shortEffect: string | null;
  readonly effect: string | null;
  readonly flavorText: string | null;
  readonly meta: MoveMeta | null;
  readonly flags: readonly MoveFlag[];
  /** TM/HM/TR teaching it in the context game. */
  readonly machine: { readonly label: string; readonly itemId: number } | null;
  readonly zMove: ZMoveInfo | null;
  readonly maxMove: MaxMoveInfo | null;
  readonly variantOf: readonly MoveVariantSource[];
}

type Named = NamedEntity | null;
const named = (id: number | null, identifier: string | null, name: string | null): Named =>
  id === null || identifier === null ? null : { id, identifier, name: name ?? identifier };

function fillEffectChance(text: string | null, chance: number | null): string | null {
  if (text === null) return null;
  const filled = chance === null ? text : text.replaceAll('$effect_chance', String(chance));
  return stripProseMarkup(filled);
}

function parseBoosts(json: string | null): Record<string, number> | null {
  if (json === null) return null;
  try {
    return JSON.parse(json) as Record<string, number>;
  } catch {
    return null;
  }
}

async function moveStats(
  db: AnySQLiteDatabase,
  moveId: number,
  ctx: GameContext,
): Promise<{ stats: MoveStats; effectId: number | null; typeId: number; inGame: boolean } | null> {
  const { langChain } = ctx;
  const base = baseVersionGroup(ctx);
  // The game's version group, else the latest one that has the move.
  const row = (await db.get(sql`
    SELECT ms.version_group_id, ms.type_id, t.identifier AS type, dc.identifier AS damage_class,
      ms.power, ms.accuracy, ms.pp, ms.priority, ms.effect_id, ms.effect_chance,
      mt.identifier AS target,
      ${pickI18n('move_target_i18n', 'target_id', sql`mt.id`, 'name', langChain)} AS target_name,
      ${pickI18n('move_target_i18n', 'target_id', sql`mt.id`, 'description', langChain)} AS target_description
    FROM move_stats_by_vg ms
    JOIN version_groups vg ON vg.id = ms.version_group_id
    JOIN types t ON t.id = ms.type_id
    JOIN move_damage_classes dc ON dc.id = ms.damage_class_id
    JOIN move_targets mt ON mt.id = ms.target_id
    WHERE ms.move_id = ${moveId}
    ORDER BY ms.version_group_id = ${base} DESC, vg.sort_order DESC LIMIT 1`)) as
    | {
        version_group_id: number;
        type_id: number;
        type: string;
        damage_class: DamageClass;
        power: number | null;
        accuracy: number | null;
        pp: number | null;
        priority: number;
        effect_id: number | null;
        effect_chance: number | null;
        target: string;
        target_name: string | null;
        target_description: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    inGame: row.version_group_id === base,
    effectId: row.effect_id,
    typeId: row.type_id,
    stats: {
      versionGroupId: row.version_group_id,
      type: row.type,
      damageClass: row.damage_class,
      power: row.power,
      accuracy: row.accuracy,
      pp: row.pp,
      maxPp: row.pp === null ? null : Math.floor((row.pp * 8) / 5),
      priority: row.priority,
      target: {
        identifier: row.target,
        name: row.target_name || row.target,
        description: row.target_description,
      },
      effectChance: row.effect_chance,
    },
  };
}

async function moveMeta(
  db: AnySQLiteDatabase,
  moveId: number,
  langChain: readonly string[],
): Promise<MoveMeta | null> {
  const row = (await db.get(sql`
    SELECT c.identifier AS category, a.id AS ailment_id, a.identifier AS ailment,
      ${pickI18n('move_meta_ailment_i18n', 'ailment_id', sql`a.id`, 'name', langChain)} AS ailment_name,
      mm.min_hits, mm.max_hits, mm.min_turns, mm.max_turns, mm.drain, mm.healing, mm.crit_rate,
      mm.ailment_chance, mm.flinch_chance, mm.stat_chance
    FROM move_meta mm
    LEFT JOIN move_meta_categories c ON c.id = mm.category_id
    LEFT JOIN move_meta_ailments a ON a.id = mm.ailment_id AND a.identifier NOT IN ('none', 'unknown')
    WHERE mm.move_id = ${moveId}`)) as
    | {
        category: string | null;
        ailment_id: number | null;
        ailment: string | null;
        ailment_name: string | null;
        min_hits: number | null;
        max_hits: number | null;
        min_turns: number | null;
        max_turns: number | null;
        drain: number | null;
        healing: number | null;
        crit_rate: number | null;
        ailment_chance: number | null;
        flinch_chance: number | null;
        stat_chance: number | null;
      }
    | undefined;
  if (!row) return null;
  const changes = (await db.all(sql`
    SELECT s.identifier AS stat, c.change FROM move_meta_stat_changes c
    JOIN stats s ON s.id = c.stat_id WHERE c.move_id = ${moveId} ORDER BY s.id`)) as {
    stat: string;
    change: number;
  }[];
  return {
    category: row.category,
    ailment: named(row.ailment_id, row.ailment, row.ailment_name),
    minHits: row.min_hits,
    maxHits: row.max_hits,
    minTurns: row.min_turns,
    maxTurns: row.max_turns,
    drain: row.drain ?? 0,
    healing: row.healing ?? 0,
    critRate: row.crit_rate ?? 0,
    ailmentChance: row.ailment_chance ?? 0,
    flinchChance: row.flinch_chance ?? 0,
    statChance: row.stat_chance ?? 0,
    statChanges: changes,
  };
}

const moveName = (id: SQL, langChain: readonly string[]) =>
  sql`COALESCE(${pickI18n('move_i18n', 'move_id', id, 'name', langChain)}, (SELECT identifier FROM moves WHERE id = ${id}))`;
const itemName = (id: SQL, langChain: readonly string[]) =>
  pickI18n('item_i18n', 'item_id', id, 'name', langChain);

/** Display name of the variety `pokemonIdColumn` (any query alias). */
function varietyName(pokemonIdColumn: SQL, langChain: readonly string[]): SQL {
  return sql`(SELECT ${pokemonName(sql`p.id`, langChain)} FROM pokemon p WHERE p.id = ${pokemonIdColumn})`;
}

/** Type of a Z-Move / Max Move (constant across version groups). */
const variantTypeId = sql`(SELECT type_id FROM move_stats_by_vg WHERE move_id = mv.variant_move_id LIMIT 1)`;
const variantClass = sql`(SELECT dc.identifier FROM move_stats_by_vg x
  JOIN move_damage_classes dc ON dc.id = x.damage_class_id
  WHERE x.move_id = mv.variant_move_id LIMIT 1)`;

interface VariantRow {
  kind: string;
  move_id: number;
  move_identifier: string;
  move_name: string;
  item_id: number | null;
  item_identifier: string | null;
  item_name: string | null;
  pokemon_id: number | null;
  pokemon_name: string | null;
  base_id: number | null;
  base_identifier: string | null;
  base_name: string | null;
  type: string | null;
  damage_class: string | null;
}

async function variantRows(db: AnySQLiteDatabase, where: SQL, langChain: readonly string[]) {
  return (await db.all(sql`
    SELECT mv.kind, v.id AS move_id, v.identifier AS move_identifier,
      ${moveName(sql`v.id`, langChain)} AS move_name,
      i.id AS item_id, i.identifier AS item_identifier,
      ${itemName(sql`i.id`, langChain)} AS item_name,
      mv.pokemon_id, ${varietyName(sql`mv.pokemon_id`, langChain)} AS pokemon_name,
      b.id AS base_id, b.identifier AS base_identifier,
      ${moveName(sql`b.id`, langChain)} AS base_name,
      (SELECT identifier FROM types WHERE id = ${variantTypeId}) AS type,
      ${variantClass} AS damage_class
    FROM move_variants mv
    JOIN moves v ON v.id = mv.variant_move_id
    LEFT JOIN items i ON i.id = mv.required_item_id
    LEFT JOIN moves b ON b.id = mv.base_move_id
    WHERE ${where}
    ORDER BY mv.id`)) as VariantRow[];
}

const pokemonRef = (id: number | null, name: string | null) =>
  id === null ? null : { id, name: name ?? String(id) };

async function zMoveInfo(
  db: AnySQLiteDatabase,
  move: { id: number; zPower: number | null; zEffect: string | null; zBoosts: string | null },
  stats: { typeId: number; damageClass: DamageClass },
  langChain: readonly string[],
): Promise<ZMoveInfo | null> {
  const generic =
    stats.damageClass === 'status'
      ? undefined
      : (
          await variantRows(
            db,
            sql`mv.kind = 'z' AND ${variantTypeId} = ${stats.typeId}`,
            langChain,
          )
        )[0];
  // PokeAPI splits each Z-Move into a physical and a special entry: link the matching one.
  const sibling = generic
    ? ((await db.get(sql`
        SELECT v.id, v.identifier FROM moves v
        JOIN move_stats_by_vg x ON x.move_id = v.id
        JOIN move_damage_classes dc ON dc.id = x.damage_class_id
        WHERE v.ps_id = (SELECT ps_id FROM moves WHERE id = ${generic.move_id})
          AND dc.identifier = ${stats.damageClass}
        LIMIT 1`)) as { id: number; identifier: string } | undefined)
    : undefined;
  const signatures = await variantRows(
    db,
    sql`mv.kind = 'z_signature' AND mv.base_move_id = ${move.id}`,
    langChain,
  );
  const boosts = parseBoosts(move.zBoosts);
  if (
    move.zPower === null &&
    move.zEffect === null &&
    boosts === null &&
    !generic &&
    signatures.length === 0
  ) {
    return null;
  }
  return {
    power: move.zPower,
    effect: move.zEffect,
    boosts,
    move: generic
      ? {
          id: sibling?.id ?? generic.move_id,
          identifier: sibling?.identifier ?? generic.move_identifier,
          name: generic.move_name,
        }
      : null,
    crystal: generic ? named(generic.item_id, generic.item_identifier, generic.item_name) : null,
    signatures: signatures.map((row) => ({
      move: { id: row.move_id, identifier: row.move_identifier, name: row.move_name },
      crystal: named(row.item_id, row.item_identifier, row.item_name),
      pokemon: pokemonRef(row.pokemon_id, row.pokemon_name),
    })),
  };
}

/** G-Max Moves, optionally of one type (RF03.4). */
export async function listGmaxMoves(
  db: AnySQLiteDatabase,
  ctx: Pick<GameContext, 'langChain'>,
  typeId?: number,
): Promise<GmaxMove[]> {
  const rows = (await db.all(sql`
    SELECT g.ps_id, g.name, t.identifier AS type, g.power, g.description, g.pokemon_id,
      ${varietyName(sql`g.pokemon_id`, ctx.langChain)} AS pokemon_name
    FROM gmax_moves g JOIN types t ON t.id = g.type_id
    ${typeId === undefined ? sql`` : sql`WHERE g.type_id = ${typeId}`}
    ORDER BY g.name`)) as {
    ps_id: string;
    name: string;
    type: string;
    power: number | null;
    description: string | null;
    pokemon_id: number | null;
    pokemon_name: string | null;
  }[];
  return rows.map((row) => ({
    psId: row.ps_id,
    name: row.name,
    type: row.type,
    power: row.power,
    description: row.description,
    pokemon: pokemonRef(row.pokemon_id, row.pokemon_name),
  }));
}

async function maxMoveInfo(
  db: AnySQLiteDatabase,
  maxPower: number | null,
  stats: { typeId: number; damageClass: DamageClass },
  ctx: GameContext,
): Promise<MaxMoveInfo | null> {
  const status = stats.damageClass === 'status';
  const generic = (
    await variantRows(
      db,
      status
        ? sql`mv.kind = 'max' AND ${variantClass} = 'status'`
        : sql`mv.kind = 'max' AND ${variantTypeId} = ${stats.typeId} AND ${variantClass} <> 'status'`,
      ctx.langChain,
    )
  )[0];
  const gmax = status ? [] : await listGmaxMoves(db, ctx, stats.typeId);
  if (maxPower === null && !generic) return null;
  return {
    power: maxPower,
    move: generic ? named(generic.move_id, generic.move_identifier, generic.move_name) : null,
    gmax,
  };
}

/** Move detail (RF03.2) with Z-Move / Max Move data (RF03.4), resolved for the context game. */
export async function getMoveDetail(
  db: AnySQLiteDatabase,
  moveId: number,
  ctx: GameContext,
): Promise<MoveDetail | null> {
  const { langChain } = ctx;
  const row = (await db.get(sql`
    SELECT m.id, m.identifier, m.generation_id, m.variant_kind, m.z_power, m.z_effect,
      m.z_boosts, m.max_power, ${moveName(sql`m.id`, langChain)} AS name
    FROM moves m WHERE m.id = ${moveId}`)) as
    | {
        id: number;
        identifier: string;
        generation_id: number;
        variant_kind: string | null;
        z_power: number | null;
        z_effect: string | null;
        z_boosts: string | null;
        max_power: number | null;
        name: string;
      }
    | undefined;
  if (!row) return null;

  const resolved = await moveStats(db, moveId, ctx);
  const prose = resolved?.effectId
    ? ((await db.get(sql`
        SELECT ${pickI18n('move_effect_i18n', 'effect_id', sql`${resolved.effectId}`, 'short_effect', langChain)} AS short_effect,
          ${pickI18n('move_effect_i18n', 'effect_id', sql`${resolved.effectId}`, 'effect', langChain)} AS effect`)) as {
        short_effect: string | null;
        effect: string | null;
      })
    : null;
  const chance = resolved?.stats.effectChance ?? null;

  const flags = (await db.all(sql`
    SELECT f.identifier,
      ${pickI18n('move_flag_i18n', 'flag_id', sql`f.id`, 'name', langChain)} AS name,
      ${pickI18n('move_flag_i18n', 'flag_id', sql`f.id`, 'description', langChain)} AS description
    FROM move_flag_map fm JOIN move_flags f ON f.id = fm.flag_id
    WHERE fm.move_id = ${moveId} ORDER BY f.id`)) as {
    identifier: string;
    name: string | null;
    description: string | null;
  }[];

  const machine = (await db.get(sql`
    SELECT i.id, i.identifier FROM machines mc JOIN items i ON i.id = mc.item_id
    WHERE mc.move_id = ${moveId} AND mc.version_group_id IN (${sqlList(ctx.versionGroupIds)})
    ORDER BY mc.machine_number LIMIT 1`)) as { id: number; identifier: string } | undefined;

  // Z-Moves exist twice in PokeAPI (physical and special): match variants by Showdown ID.
  const sources =
    row.variant_kind === null
      ? []
      : await variantRows(
          db,
          sql`mv.variant_move_id IN (SELECT id FROM moves WHERE id = ${moveId}
            OR ps_id = (SELECT ps_id FROM moves WHERE id = ${moveId}))`,
          langChain,
        );

  const typed = resolved
    ? { typeId: resolved.typeId, damageClass: resolved.stats.damageClass }
    : null;
  return {
    id: row.id,
    identifier: row.identifier,
    name: row.name,
    generationId: row.generation_id,
    variantKind: row.variant_kind,
    inGame: resolved?.inGame ?? false,
    stats: resolved?.stats ?? null,
    shortEffect: fillEffectChance(prose?.short_effect ?? null, chance),
    effect: fillEffectChance(prose?.effect ?? null, chance),
    flavorText: await latestFlavorText(db, 'move_flavor_text', moveId, ctx),
    meta: await moveMeta(db, moveId, langChain),
    flags: flags.map((flag) => ({
      identifier: flag.identifier,
      name: flag.name ?? flag.identifier,
      description: flag.description,
    })),
    machine: machine ? { label: machineLabel(machine.identifier), itemId: machine.id } : null,
    zMove:
      typed && row.variant_kind === null
        ? await zMoveInfo(
            db,
            { id: row.id, zPower: row.z_power, zEffect: row.z_effect, zBoosts: row.z_boosts },
            typed,
            langChain,
          )
        : null,
    maxMove:
      typed && row.variant_kind === null ? await maxMoveInfo(db, row.max_power, typed, ctx) : null,
    variantOf: sources.map((source) => ({
      kind: source.kind,
      type: source.kind === 'z_signature' ? null : source.type,
      baseMove: named(source.base_id, source.base_identifier, source.base_name),
      crystal: named(source.item_id, source.item_identifier, source.item_name),
      pokemon: pokemonRef(source.pokemon_id, source.pokemon_name),
    })),
  };
}

// --- Learners (RF03.3) ----------------------------------------------------------------------

export interface MoveLearnMethod {
  readonly tab: LearnTab;
  /** PokeAPI learn method identifier. */
  readonly method: string;
  readonly level: number;
}

export interface MoveLearner {
  readonly pokemonId: number;
  readonly speciesId: number;
  readonly name: string;
  readonly isDefault: boolean;
  /** Type identifiers as of the context generation. */
  readonly types: readonly string[];
  /** Whether the variety is available in the context game. */
  readonly inGame: boolean;
  readonly methods: readonly MoveLearnMethod[];
}

/** Every variety that learns the move in the context game, and how (RF03.3). */
export async function getMoveLearners(
  db: AnySQLiteDatabase,
  moveId: number,
  ctx: GameContext,
): Promise<MoveLearner[]> {
  const { langChain, generationId } = ctx;
  const vgs = sqlList(ctx.versionGroupIds);
  const methodRows = (await db.all(sql`
    SELECT DISTINCT pm.pokemon_id, m.identifier AS method, pm.level, pm.method_id
    FROM pokemon_moves pm JOIN move_learn_methods m ON m.id = pm.method_id
    WHERE pm.move_id = ${moveId} AND pm.version_group_id IN (${vgs})
    ORDER BY pm.method_id, pm.level`)) as {
    pokemon_id: number;
    method: string;
    level: number;
  }[];
  if (methodRows.length === 0) return [];

  const learners = (await db.all(sql`
    WITH learners AS (
      SELECT DISTINCT pokemon_id FROM pokemon_moves
      WHERE move_id = ${moveId} AND version_group_id IN (${vgs})
    )
    SELECT p.id, p.species_id, p.is_default, ${pokemonName(sql`p.id`, langChain)} AS name,
      (SELECT group_concat(identifier, ',') FROM (
         SELECT t.identifier FROM pokemon_types_by_gen pt JOIN types t ON t.id = pt.type_id
         WHERE pt.pokemon_id = p.id AND pt.generation_id = ${generationId} ORDER BY pt.slot)) AS types,
      EXISTS (SELECT 1 FROM game_pokemon gp
              WHERE gp.game_id = ${ctx.gameId} AND gp.pokemon_id = p.id) AS in_game
    FROM learners l JOIN pokemon p ON p.id = l.pokemon_id
    ORDER BY p.species_id, p.is_default DESC, p.id`)) as {
    id: number;
    species_id: number;
    is_default: number;
    name: string;
    types: string | null;
    in_game: number;
  }[];

  const methods = new Map<number, MoveLearnMethod[]>();
  for (const row of methodRows) {
    const list = methods.get(row.pokemon_id) ?? [];
    list.push({
      tab: tabOf(row.method, row.level, generationId),
      method: row.method,
      level: row.level,
    });
    methods.set(row.pokemon_id, list);
  }
  return learners.map((row) => ({
    pokemonId: row.id,
    speciesId: row.species_id,
    name: row.name,
    isDefault: row.is_default === 1,
    types: row.types ? row.types.split(',') : [],
    inGame: row.in_game === 1,
    methods: methods.get(row.id) ?? [],
  }));
}
