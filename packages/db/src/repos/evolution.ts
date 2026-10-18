import { sql, type SQL } from 'drizzle-orm';
import { pickI18n, sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';
import type { NamedEntity } from './catalog';
import { pokemonName } from './pokemon';

/** One way to evolve into a species (RF02.5), with every referenced entity resolved. */
export interface EvolutionMethod {
  /** level-up | trade | use-item | shed | spin | three-critical-hits | … */
  readonly trigger: string;
  readonly triggerName: string;
  readonly minLevel: number | null;
  readonly item: NamedEntity | null;
  readonly heldItem: NamedEntity | null;
  readonly gender: 'female' | 'male' | null;
  readonly location: NamedEntity | null;
  /** day | night | dusk | full-moon … */
  readonly timeOfDay: string | null;
  readonly knownMove: NamedEntity | null;
  readonly knownMoveType: NamedEntity | null;
  readonly minHappiness: number | null;
  readonly minBeauty: number | null;
  readonly minAffection: number | null;
  /** 1 = Attack > Defense, 0 = equal, -1 = Attack < Defense. */
  readonly relativePhysicalStats: number | null;
  readonly partySpecies: NamedEntity | null;
  readonly partyType: NamedEntity | null;
  readonly tradeSpecies: NamedEntity | null;
  readonly usedMove: NamedEntity | null;
  readonly minMoveCount: number | null;
  readonly minSteps: number | null;
  readonly minDamageTaken: number | null;
  readonly needsOverworldRain: boolean;
  readonly turnUpsideDown: boolean;
  readonly needsMultiplayer: boolean;
  readonly nearSpecialRock: boolean;
  /** Region where this method applies (regional evolutions such as Alolan Raichu). */
  readonly region: NamedEntity | null;
  /** The variety obtained, when it is not the species' default (e.g. Alolan Raichu). */
  readonly evolvedPokemon: { readonly id: number; readonly name: string } | null;
  /** The pre-evolution variety required, when it is not the default (e.g. Galarian Meowth). */
  readonly requiredPokemon: { readonly id: number; readonly name: string } | null;
  /** Version group that introduced this method (null = always). */
  readonly versionGroupId: number | null;
}

export interface EvolutionNode {
  readonly speciesId: number;
  /** Default variety, for navigation and sprites. */
  readonly pokemonId: number;
  readonly name: string;
  readonly types: readonly string[];
  readonly isBaby: boolean;
  readonly inGame: boolean;
  /** Parent in the tree (null for the root, or when the parent is newer than the game). */
  readonly evolvesFromSpeciesId: number | null;
  /** How the parent evolves into this node in the context game. */
  readonly methods: readonly EvolutionMethod[];
}

export interface EvolutionChain {
  readonly chainId: number;
  /** Roots first, then breadth-first by species order. */
  readonly nodes: readonly EvolutionNode[];
}

type Named = NamedEntity | null;

function entity(id: number | null, identifier: string | null, name: string | null): Named {
  return id === null || identifier === null ? null : { id, identifier, name: name ?? identifier };
}

function nameOf(table: string, idColumn: string, id: SQL, langChain: readonly string[]): SQL {
  return pickI18n(table, idColumn, id, 'name', langChain);
}

interface MethodRow {
  evolved_species_id: number;
  trigger_identifier: string;
  trigger_name: string | null;
  version_group_id: number | null;
  vg_order: number | null;
  min_level: number | null;
  gender_id: number | null;
  time_of_day: string | null;
  min_happiness: number | null;
  min_beauty: number | null;
  min_affection: number | null;
  relative_physical_stats: number | null;
  min_move_count: number | null;
  min_steps: number | null;
  min_damage_taken: number | null;
  needs_overworld_rain: number;
  turn_upside_down: number;
  needs_multiplayer: number;
  near_special_rock: number;
  region_id: number | null;
  region_identifier: string | null;
  region_name: string | null;
  evolved_form_id: number | null;
  item_id: number | null;
  item_identifier: string | null;
  item_name: string | null;
  held_item_id: number | null;
  held_item_identifier: string | null;
  held_item_name: string | null;
  location_id: number | null;
  location_identifier: string | null;
  location_name: string | null;
  known_move_id: number | null;
  known_move_identifier: string | null;
  known_move_name: string | null;
  used_move_id: number | null;
  used_move_identifier: string | null;
  used_move_name: string | null;
  known_type_id: number | null;
  known_type_identifier: string | null;
  known_type_name: string | null;
  party_type_id: number | null;
  party_type_identifier: string | null;
  party_type_name: string | null;
  party_species_id: number | null;
  party_species_identifier: string | null;
  party_species_name: string | null;
  trade_species_id: number | null;
  trade_species_identifier: string | null;
  trade_species_name: string | null;
  evolved_pokemon_id: number | null;
  evolved_is_default: number | null;
  evolved_name: string | null;
  required_pokemon_id: number | null;
  required_is_default: number | null;
  required_name: string | null;
}

function toMethod(row: MethodRow): EvolutionMethod {
  return {
    trigger: row.trigger_identifier,
    triggerName: row.trigger_name ?? row.trigger_identifier,
    minLevel: row.min_level,
    item: entity(row.item_id, row.item_identifier, row.item_name),
    heldItem: entity(row.held_item_id, row.held_item_identifier, row.held_item_name),
    gender: row.gender_id === 1 ? 'female' : row.gender_id === 2 ? 'male' : null,
    location: entity(row.location_id, row.location_identifier, row.location_name),
    timeOfDay: row.time_of_day,
    knownMove: entity(row.known_move_id, row.known_move_identifier, row.known_move_name),
    knownMoveType: entity(row.known_type_id, row.known_type_identifier, row.known_type_name),
    minHappiness: row.min_happiness,
    minBeauty: row.min_beauty,
    minAffection: row.min_affection,
    relativePhysicalStats: row.relative_physical_stats,
    partySpecies: entity(
      row.party_species_id,
      row.party_species_identifier,
      row.party_species_name,
    ),
    partyType: entity(row.party_type_id, row.party_type_identifier, row.party_type_name),
    tradeSpecies: entity(
      row.trade_species_id,
      row.trade_species_identifier,
      row.trade_species_name,
    ),
    usedMove: entity(row.used_move_id, row.used_move_identifier, row.used_move_name),
    minMoveCount: row.min_move_count,
    minSteps: row.min_steps,
    minDamageTaken: row.min_damage_taken,
    needsOverworldRain: row.needs_overworld_rain === 1,
    turnUpsideDown: row.turn_upside_down === 1,
    needsMultiplayer: row.needs_multiplayer === 1,
    nearSpecialRock: row.near_special_rock === 1,
    region: entity(row.region_id, row.region_identifier, row.region_name),
    evolvedPokemon:
      row.evolved_pokemon_id !== null && row.evolved_is_default === 0
        ? { id: row.evolved_pokemon_id, name: row.evolved_name ?? '' }
        : null,
    requiredPokemon:
      row.required_pokemon_id !== null && row.required_is_default === 0
        ? { id: row.required_pokemon_id, name: row.required_name ?? '' }
        : null,
    versionGroupId: row.version_group_id,
  };
}

/**
 * Keeps the methods valid in the context game. PokeAPI rows carry the version group that
 * introduced them; a newer row supersedes older ones of the same "track" (same evolved form
 * and region). Region-bound rows only apply in games set in that region.
 */
export function resolveEvolutionMethods<
  R extends {
    evolved_species_id: number;
    evolved_form_id: number | null;
    region_id: number | null;
    vg_order: number | null;
  },
>(rows: readonly R[], maxOrder: number, regionIds: ReadonlySet<number>): R[] {
  const applicable = rows.filter(
    (row) =>
      (row.vg_order === null || row.vg_order <= maxOrder) &&
      (row.region_id === null || regionIds.has(row.region_id)),
  );
  const latest = new Map<string, number>();
  const trackOf = (row: R) =>
    `${row.evolved_species_id}:${row.evolved_form_id ?? ''}:${row.region_id ?? ''}`;
  for (const row of applicable) {
    const track = trackOf(row);
    latest.set(track, Math.max(latest.get(track) ?? -1, row.vg_order ?? 0));
  }
  return applicable.filter((row) => (row.vg_order ?? 0) === latest.get(trackOf(row)));
}

/** Evolution tree of a species as of the context game (RF02.5). */
export async function getEvolutionChain(
  db: AnySQLiteDatabase,
  speciesId: number,
  ctx: GameContext,
): Promise<EvolutionChain | null> {
  const { langChain, generationId } = ctx;
  const chain = (await db.get(
    sql`SELECT evolution_chain_id AS id FROM pokemon_species WHERE id = ${speciesId}`,
  )) as { id: number | null } | undefined;
  if (!chain || chain.id === null) return null;

  const speciesRows = (await db.all(sql`
    SELECT ps.id AS species_id, ps.evolves_from_species_id, ps.is_baby, p.id AS pokemon_id,
      ${pokemonName(sql`p.id`, langChain)} AS name,
      (SELECT group_concat(identifier, ',') FROM (
         SELECT t.identifier FROM pokemon_types_by_gen pt JOIN types t ON t.id = pt.type_id
         WHERE pt.pokemon_id = p.id AND pt.generation_id = ${generationId} ORDER BY pt.slot)) AS types,
      EXISTS (SELECT 1 FROM game_pokemon gp WHERE gp.game_id = ${ctx.gameId} AND gp.pokemon_id = p.id) AS in_game
    FROM pokemon_species ps
    JOIN pokemon p ON p.species_id = ps.id AND p.is_default = 1
    WHERE ps.evolution_chain_id = ${chain.id} AND ps.generation_id <= ${generationId}
    ORDER BY ps.sort_order, ps.id`)) as {
    species_id: number;
    evolves_from_species_id: number | null;
    is_baby: number;
    pokemon_id: number;
    name: string;
    types: string | null;
    in_game: number;
  }[];
  if (speciesRows.length === 0) return null;
  const present = new Set(speciesRows.map((row) => row.species_id));

  const methodRows = (await db.all(sql`
    SELECT e.evolved_species_id, e.version_group_id, vg.sort_order AS vg_order,
      e.min_level, e.gender_id, e.time_of_day, e.min_happiness, e.min_beauty, e.min_affection,
      e.relative_physical_stats, e.min_move_count, e.min_steps, e.min_damage_taken,
      e.needs_overworld_rain, e.turn_upside_down, e.needs_multiplayer, e.near_special_rock,
      e.evolved_form_id,
      tr.identifier AS trigger_identifier,
      ${nameOf('evolution_trigger_i18n', 'evolution_trigger_id', sql`tr.id`, langChain)} AS trigger_name,
      e.region_id, r.identifier AS region_identifier,
      ${nameOf('region_i18n', 'region_id', sql`r.id`, langChain)} AS region_name,
      e.trigger_item_id AS item_id, it.identifier AS item_identifier,
      ${nameOf('item_i18n', 'item_id', sql`it.id`, langChain)} AS item_name,
      e.held_item_id, hi.identifier AS held_item_identifier,
      ${nameOf('item_i18n', 'item_id', sql`hi.id`, langChain)} AS held_item_name,
      e.location_id, l.identifier AS location_identifier,
      ${nameOf('location_i18n', 'location_id', sql`l.id`, langChain)} AS location_name,
      e.known_move_id, km.identifier AS known_move_identifier,
      ${nameOf('move_i18n', 'move_id', sql`km.id`, langChain)} AS known_move_name,
      e.used_move_id, um.identifier AS used_move_identifier,
      ${nameOf('move_i18n', 'move_id', sql`um.id`, langChain)} AS used_move_name,
      e.known_move_type_id AS known_type_id, kt.identifier AS known_type_identifier,
      ${nameOf('type_i18n', 'type_id', sql`kt.id`, langChain)} AS known_type_name,
      e.party_type_id, pt.identifier AS party_type_identifier,
      ${nameOf('type_i18n', 'type_id', sql`pt.id`, langChain)} AS party_type_name,
      e.party_species_id, pps.identifier AS party_species_identifier,
      ${nameOf('species_i18n', 'species_id', sql`pps.id`, langChain)} AS party_species_name,
      e.trade_species_id, tps.identifier AS trade_species_identifier,
      ${nameOf('species_i18n', 'species_id', sql`tps.id`, langChain)} AS trade_species_name,
      ef.pokemon_id AS evolved_pokemon_id, evp.is_default AS evolved_is_default,
      ${pickI18n('form_i18n', 'form_id', sql`ef.id`, 'pokemon_name', langChain)} AS evolved_name,
      rf.pokemon_id AS required_pokemon_id, rqp.is_default AS required_is_default,
      ${pickI18n('form_i18n', 'form_id', sql`rf.id`, 'pokemon_name', langChain)} AS required_name
    FROM pokemon_evolution e
    JOIN evolution_triggers tr ON tr.id = e.trigger_id
    LEFT JOIN version_groups vg ON vg.id = e.version_group_id
    LEFT JOIN regions r ON r.id = e.region_id
    LEFT JOIN items it ON it.id = e.trigger_item_id
    LEFT JOIN items hi ON hi.id = e.held_item_id
    LEFT JOIN locations l ON l.id = e.location_id
    LEFT JOIN moves km ON km.id = e.known_move_id
    LEFT JOIN moves um ON um.id = e.used_move_id
    LEFT JOIN types kt ON kt.id = e.known_move_type_id
    LEFT JOIN types pt ON pt.id = e.party_type_id
    LEFT JOIN pokemon_species pps ON pps.id = e.party_species_id
    LEFT JOIN pokemon_species tps ON tps.id = e.trade_species_id
    LEFT JOIN pokemon_forms ef ON ef.id = e.evolved_form_id
    LEFT JOIN pokemon evp ON evp.id = ef.pokemon_id
    LEFT JOIN pokemon_forms rf ON rf.id = e.required_form_id
    LEFT JOIN pokemon rqp ON rqp.id = rf.pokemon_id
    WHERE e.evolved_species_id IN (${sqlList([...present])})
    ORDER BY e.is_default DESC, e.id`)) as MethodRow[];

  const scope = (await db.get(sql`
    SELECT max(sort_order) AS max_order FROM version_groups
    WHERE id IN (${sqlList(ctx.versionGroupIds)})`)) as { max_order: number | null };
  const regions = (await db.all(sql`
    SELECT DISTINCT region_id FROM version_group_regions
    WHERE version_group_id IN (${sqlList(ctx.versionGroupIds)})`)) as { region_id: number }[];
  const methods = resolveEvolutionMethods(
    methodRows,
    scope.max_order ?? Number.MAX_SAFE_INTEGER,
    new Set(regions.map((row) => row.region_id)),
  );

  const nodes = speciesRows.map((row): EvolutionNode => ({
    speciesId: row.species_id,
    pokemonId: row.pokemon_id,
    name: row.name,
    types: row.types ? row.types.split(',') : [],
    isBaby: row.is_baby === 1,
    inGame: row.in_game === 1,
    evolvesFromSpeciesId:
      row.evolves_from_species_id !== null && present.has(row.evolves_from_species_id)
        ? row.evolves_from_species_id
        : null,
    methods: methods.filter((m) => m.evolved_species_id === row.species_id).map(toMethod),
  }));

  // Breadth-first from the roots, so a renderer can lay out stages left to right.
  const ordered: EvolutionNode[] = [];
  let frontier = nodes.filter((node) => node.evolvesFromSpeciesId === null);
  while (frontier.length > 0) {
    ordered.push(...frontier);
    const parents = new Set(frontier.map((node) => node.speciesId));
    frontier = nodes.filter(
      (node) => node.evolvesFromSpeciesId !== null && parents.has(node.evolvesFromSpeciesId),
    );
  }
  return { chainId: chain.id, nodes: ordered };
}

/** default | mega | primal | gmax | regional_alola|galar|hisui|paldea | totem | battle | item | cosmetic | other */
export type FormKind = string;

export interface PokemonVariety {
  readonly pokemonId: number;
  readonly identifier: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly formKind: FormKind;
  readonly types: readonly string[];
  readonly inGame: boolean;
  /** How the default variety turns into this one (Mega Stone, G-Max, Primal orb…). */
  readonly change: {
    readonly kind: string;
    readonly item: NamedEntity | null;
    readonly move: NamedEntity | null;
    readonly ability: NamedEntity | null;
  } | null;
}

export interface CosmeticForm {
  readonly formId: number;
  readonly identifier: string;
  readonly formIdentifier: string | null;
  readonly name: string;
  readonly isDefault: boolean;
}

export interface PokemonForms {
  /** Varieties of the species with their own stats (RF02.5 tabs). */
  readonly varieties: readonly PokemonVariety[];
  /** Forms sharing this variety's stats (Unown letters, Vivillon patterns…). */
  readonly cosmeticForms: readonly CosmeticForm[];
}

/** Alternate forms of a variety's species (RF02.5): Mega, regional, G-Max, item forms… */
export async function getPokemonForms(
  db: AnySQLiteDatabase,
  pokemonId: number,
  ctx: GameContext,
): Promise<PokemonForms> {
  const { langChain, generationId } = ctx;
  const varieties = (await db.all(sql`
    SELECT p.id, p.identifier, p.is_default,
      ${pokemonName(sql`p.id`, langChain)} AS name,
      (SELECT f.form_kind FROM pokemon_forms f WHERE f.pokemon_id = p.id AND f.is_default = 1 LIMIT 1) AS form_kind,
      (SELECT group_concat(identifier, ',') FROM (
         SELECT t.identifier FROM pokemon_types_by_gen pt JOIN types t ON t.id = pt.type_id
         WHERE pt.pokemon_id = p.id AND pt.generation_id = ${generationId} ORDER BY pt.slot)) AS types,
      EXISTS (SELECT 1 FROM game_pokemon gp WHERE gp.game_id = ${ctx.gameId} AND gp.pokemon_id = p.id) AS in_game,
      fc.kind AS change_kind,
      fc.item_id, i.identifier AS item_identifier,
      ${nameOf('item_i18n', 'item_id', sql`i.id`, langChain)} AS item_name,
      fc.move_id, m.identifier AS move_identifier,
      ${nameOf('move_i18n', 'move_id', sql`m.id`, langChain)} AS move_name,
      fc.ability_id, a.identifier AS ability_identifier,
      ${nameOf('ability_i18n', 'ability_id', sql`a.id`, langChain)} AS ability_name
    FROM pokemon p
    LEFT JOIN form_changes fc ON fc.to_pokemon_id = p.id
    LEFT JOIN items i ON i.id = fc.item_id
    LEFT JOIN moves m ON m.id = fc.move_id
    LEFT JOIN abilities a ON a.id = fc.ability_id
    WHERE p.species_id = (SELECT species_id FROM pokemon WHERE id = ${pokemonId})
    GROUP BY p.id
    ORDER BY p.is_default DESC, p.sort_order, p.id`)) as {
    id: number;
    identifier: string;
    is_default: number;
    name: string;
    form_kind: string | null;
    types: string | null;
    in_game: number;
    change_kind: string | null;
    item_id: number | null;
    item_identifier: string | null;
    item_name: string | null;
    move_id: number | null;
    move_identifier: string | null;
    move_name: string | null;
    ability_id: number | null;
    ability_identifier: string | null;
    ability_name: string | null;
  }[];

  const forms = (await db.all(sql`
    SELECT f.id, f.identifier, f.form_identifier, f.is_default,
      COALESCE(${pickI18n('form_i18n', 'form_id', sql`f.id`, 'form_name', langChain)},
               f.form_identifier, f.identifier) AS name
    FROM pokemon_forms f WHERE f.pokemon_id = ${pokemonId}
    ORDER BY f.form_order, f.id`)) as {
    id: number;
    identifier: string;
    form_identifier: string | null;
    is_default: number;
    name: string;
  }[];

  return {
    varieties: varieties.map((row) => ({
      pokemonId: row.id,
      identifier: row.identifier,
      name: row.name,
      isDefault: row.is_default === 1,
      formKind: row.form_kind ?? (row.is_default === 1 ? 'default' : 'other'),
      types: row.types ? row.types.split(',') : [],
      inGame: row.in_game === 1,
      change:
        row.change_kind === null
          ? null
          : {
              kind: row.change_kind,
              item: entity(row.item_id, row.item_identifier, row.item_name),
              move: entity(row.move_id, row.move_identifier, row.move_name),
              ability: entity(row.ability_id, row.ability_identifier, row.ability_name),
            },
    })),
    cosmeticForms:
      forms.length > 1
        ? forms.map((row) => ({
            formId: row.id,
            identifier: row.identifier,
            formIdentifier: row.form_identifier,
            name: row.name,
            isDefault: row.is_default === 1,
          }))
        : [],
  };
}
