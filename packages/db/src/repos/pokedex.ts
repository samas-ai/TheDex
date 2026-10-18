import { sql, type SQL } from 'drizzle-orm';
import { sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';
import { pokemonName } from './pokemon';

/** RF01.4 sort keys. `number` = regional number of the context game (national as fallback). */
export const POKEDEX_SORT_KEYS = [
  'number',
  'national',
  'name',
  'height',
  'weight',
  'bst',
  'hp',
  'attack',
  'defense',
  'special-attack',
  'special-defense',
  'speed',
] as const;
export type PokedexSortKey = (typeof POKEDEX_SORT_KEYS)[number];
export type SortDirection = 'asc' | 'desc';

/** Capture status filter (RF01.3), read from the attached thedex-user.db checklist. */
export type CaptureStatus = 'seen' | 'caught' | 'shiny' | 'not-caught';

export interface PokedexFilters {
  /** Type ids; every one must match (1 or 2 combined types). */
  readonly typeIds?: readonly number[];
  /** Generations the species was introduced in (any). */
  readonly generationIds?: readonly number[];
  /** Regions whose regional Pokédex lists the species (any). */
  readonly regionIds?: readonly number[];
  readonly abilityId?: number | null;
  readonly eggGroupId?: number | null;
  /** species_tags categories (any): starter, legendary, mythical, ultra_beast, paradox… */
  readonly tags?: readonly string[];
  /** Checklist status in `scope` (`national` or a game scope, see checklist_entries). */
  readonly capture?: { readonly scope: string; readonly status: CaptureStatus } | null;
  /** Include alternate varieties (Mega, regional, G-Max…). Default true. */
  readonly includeForms?: boolean;
}

export interface PokedexQuery {
  readonly filters?: PokedexFilters;
  readonly sort?: { readonly key: PokedexSortKey; readonly direction: SortDirection };
  readonly limit?: number;
  readonly offset?: number;
}

export interface PokedexEntry {
  readonly id: number;
  readonly identifier: string;
  readonly speciesId: number;
  /** National Pokédex number (= species id). */
  readonly nationalNumber: number;
  readonly regionalNumber: number | null;
  /** Regional Pokédex the number belongs to (games such as SV have several). */
  readonly pokedexId: number | null;
  readonly isDefault: boolean;
  readonly name: string;
  /** Type identifiers in slot order, as of the context generation. */
  readonly types: readonly string[];
  readonly heightDm: number;
  readonly weightHg: number;
  /** Base stats as of the context generation (Gen 1: special-attack = special-defense = Special). */
  readonly stats: {
    readonly hp: number;
    readonly attack: number;
    readonly defense: number;
    readonly specialAttack: number;
    readonly specialDefense: number;
    readonly speed: number;
    readonly bst: number;
  } | null;
}

const SORT_COLUMNS: Readonly<Record<Exclude<PokedexSortKey, 'number' | 'national'>, string>> = {
  name: 'name COLLATE NOCASE',
  height: 'p.height_dm',
  weight: 'p.weight_hg',
  bst: 's.bst',
  hp: 's.hp',
  attack: 's.attack',
  defense: 's.defense',
  'special-attack': 's.special_attack',
  'special-defense': 's.special_defense',
  speed: 's.speed',
};

const NATIONAL_ORDER = 'p.species_id, p.is_default DESC, p.id';

function orderBy(sort: NonNullable<PokedexQuery['sort']>): SQL {
  const dir = sort.direction === 'desc' ? 'DESC' : 'ASC';
  if (sort.key === 'national') {
    return sql.raw(`p.species_id ${dir}, p.is_default DESC, p.id`);
  }
  if (sort.key === 'number') {
    // Games with several regional dexes (Paldea → Kitakami → Blueberry) list them in order;
    // varieties outside every regional dex go last, in national order.
    return sql.raw(
      `gp.regional_number IS NULL, gpd.sort_order ${dir}, gp.regional_number ${dir}, ` +
        `p.species_id ${dir}, p.is_default DESC, p.id`,
    );
  }
  const column = SORT_COLUMNS[sort.key];
  const nullsLast = sort.key === 'name' ? '' : `${column} IS NULL, `;
  return sql.raw(`${nullsLast}${column} ${dir}, ${NATIONAL_ORDER}`);
}

const CAPTURE_CONDITIONS: Readonly<Record<CaptureStatus, string>> = {
  seen: '(ce.seen = 1 OR ce.caught = 1 OR ce.shiny_caught = 1)',
  caught: '(ce.caught = 1 OR ce.shiny_caught = 1)',
  shiny: 'ce.shiny_caught = 1',
  'not-caught': '(ce.caught = 1 OR ce.shiny_caught = 1)',
};

function filterClauses(filters: PokedexFilters, ctx: GameContext): SQL[] {
  const clauses: SQL[] = [];
  const gen = ctx.generationId;
  if (filters.includeForms === false) clauses.push(sql`p.is_default = 1`);
  for (const typeId of new Set(filters.typeIds ?? [])) {
    clauses.push(sql`EXISTS (SELECT 1 FROM pokemon_types_by_gen pt
      WHERE pt.pokemon_id = p.id AND pt.generation_id = ${gen} AND pt.type_id = ${typeId})`);
  }
  if (filters.generationIds?.length) {
    clauses.push(sql`ps.generation_id IN (${sqlList(filters.generationIds)})`);
  }
  if (filters.regionIds?.length) {
    clauses.push(sql`EXISTS (SELECT 1 FROM pokemon_dex_numbers dn
      JOIN pokedexes d ON d.id = dn.pokedex_id
      WHERE dn.species_id = p.species_id AND d.region_id IN (${sqlList(filters.regionIds)}))`);
  }
  if (filters.abilityId != null) {
    clauses.push(sql`EXISTS (SELECT 1 FROM pokemon_abilities_by_gen pa
      WHERE pa.pokemon_id = p.id AND pa.generation_id = ${gen} AND pa.ability_id = ${filters.abilityId})`);
  }
  if (filters.eggGroupId != null) {
    clauses.push(sql`EXISTS (SELECT 1 FROM pokemon_egg_groups eg
      WHERE eg.species_id = p.species_id AND eg.egg_group_id = ${filters.eggGroupId})`);
  }
  if (filters.tags?.length) {
    clauses.push(sql`EXISTS (SELECT 1 FROM species_tags st
      WHERE st.species_id = p.species_id AND st.tag IN (${sqlList(filters.tags)}))`);
  }
  if (filters.capture) {
    const { scope, status } = filters.capture;
    const exists = sql`EXISTS (SELECT 1 FROM checklist_entries ce
      WHERE ce.dex_scope = ${scope} AND ce.pokemon_id = p.id AND ce.form_id = 0
        AND ce.deleted_at IS NULL AND ${sql.raw(CAPTURE_CONDITIONS[status])})`;
    clauses.push(status === 'not-caught' ? sql`NOT ${exists}` : exists);
  }
  return clauses;
}

interface EntryRow {
  id: number;
  identifier: string;
  species_id: number;
  regional_number: number | null;
  pokedex_id: number | null;
  is_default: number;
  name: string;
  types: string | null;
  height_dm: number;
  weight_hg: number;
  hp: number | null;
  attack: number | null;
  defense: number | null;
  special_attack: number | null;
  special_defense: number | null;
  speed: number | null;
  bst: number | null;
}

/**
 * RF01: varieties available in the context game with filters (RF01.3) and sorting (RF01.4).
 * Every filter is an indexed EXISTS/IN on a primary key or a `(generation_id, …)` index; the
 * capture filter joins the attached user DB. Without `limit`, the whole list is returned
 * (≈ 1 000 rows at most), which the UI virtualizes.
 */
export async function listPokedex(
  db: AnySQLiteDatabase,
  ctx: GameContext,
  query: PokedexQuery = {},
): Promise<PokedexEntry[]> {
  const { langChain, generationId, gameId } = ctx;
  const where = [sql`gp.game_id = ${gameId}`, ...filterClauses(query.filters ?? {}, ctx)];
  const page =
    query.limit === undefined ? sql`` : sql` LIMIT ${query.limit} OFFSET ${query.offset ?? 0}`;
  const rows = (await db.all(sql`
    SELECT p.id, p.identifier, p.species_id, p.is_default, p.height_dm, p.weight_hg,
      gp.regional_number, gp.pokedex_id,
      ${pokemonName(sql`p.id`, langChain)} AS name,
      (SELECT group_concat(identifier, ',') FROM (
         SELECT t.identifier FROM pokemon_types_by_gen pt JOIN types t ON t.id = pt.type_id
         WHERE pt.pokemon_id = p.id AND pt.generation_id = ${generationId} ORDER BY pt.slot)) AS types,
      s.hp, s.attack, s.defense, s.special_attack, s.special_defense, s.speed, s.bst
    FROM game_pokemon gp
    JOIN pokemon p ON p.id = gp.pokemon_id
    JOIN pokemon_species ps ON ps.id = p.species_id
    LEFT JOIN game_pokedexes gpd ON gpd.game_id = gp.game_id AND gpd.pokedex_id = gp.pokedex_id
    LEFT JOIN pokemon_stats_by_gen s ON s.pokemon_id = p.id AND s.generation_id = ${generationId}
    WHERE ${sql.join(where, sql` AND `)}
    ORDER BY ${orderBy(query.sort ?? { key: 'number', direction: 'asc' })}${page}`)) as EntryRow[];

  return rows.map((row) => ({
    id: row.id,
    identifier: row.identifier,
    speciesId: row.species_id,
    nationalNumber: row.species_id,
    regionalNumber: row.regional_number,
    pokedexId: row.pokedex_id,
    isDefault: row.is_default === 1,
    name: row.name,
    types: row.types ? row.types.split(',') : [],
    heightDm: row.height_dm,
    weightHg: row.weight_hg,
    stats:
      row.bst === null
        ? null
        : {
            hp: row.hp!,
            attack: row.attack!,
            defense: row.defense!,
            specialAttack: row.special_attack!,
            specialDefense: row.special_defense!,
            speed: row.speed!,
            bst: row.bst,
          },
  }));
}
