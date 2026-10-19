import { sql, type SQL } from 'drizzle-orm';
import { sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';
import { pokemonName } from './pokemon';

/** Which collection a checklist tracks (RF09.1): the National Dex or the selected game's. */
export type ChecklistKind = 'national' | 'game';

/** `checklist_entries.dex_scope` of a collection: `national` or `game:<curated game id>`. */
export function checklistScope(kind: ChecklistKind, gameId: number): string {
  return kind === 'national' ? 'national' : `game:${gameId}`;
}

/** A species in a checklist (its default variety; forms are not tracked separately yet). */
export interface ChecklistDexEntry {
  /** Default variety id — the `pokemon_id` stored in checklist_entries. */
  readonly pokemonId: number;
  readonly speciesId: number;
  /** National number, or the regional one in a game checklist (national when absent). */
  readonly number: number;
  /** Generation the species was introduced in (National Dex groups). */
  readonly generationId: number;
  readonly name: string;
  /** Types in the context generation (or the species' own, for later species). */
  readonly types: readonly string[];
}

/**
 * The species a checklist covers, in dex order: every species for the National Dex, the
 * game's regional dexes (in game order) for a game. Types fall back to the species'
 * generation when it is newer than the context game.
 */
export async function listChecklistDex(
  db: AnySQLiteDatabase,
  ctx: GameContext,
  kind: ChecklistKind,
): Promise<ChecklistDexEntry[]> {
  const typesGen = sql`MAX(${ctx.generationId}, ps.generation_id)`;
  const columns = sql`p.id, p.species_id, ps.generation_id,
      ${pokemonName(sql`p.id`, ctx.langChain)} AS name,
      (SELECT group_concat(identifier, ',') FROM (
         SELECT t.identifier FROM pokemon_types_by_gen pt JOIN types t ON t.id = pt.type_id
         WHERE pt.pokemon_id = p.id AND pt.generation_id = ${typesGen} ORDER BY pt.slot)) AS types`;
  const query: SQL =
    kind === 'national'
      ? sql`SELECT ${columns}, p.species_id AS number
          FROM pokemon p JOIN pokemon_species ps ON ps.id = p.species_id
          WHERE p.is_default = 1 ORDER BY p.species_id`
      : sql`SELECT ${columns}, COALESCE(gp.regional_number, p.species_id) AS number
          FROM game_pokemon gp
          JOIN pokemon p ON p.id = gp.pokemon_id
          JOIN pokemon_species ps ON ps.id = p.species_id
          LEFT JOIN game_pokedexes gpd ON gpd.game_id = gp.game_id AND gpd.pokedex_id = gp.pokedex_id
          WHERE gp.game_id = ${ctx.gameId} AND p.is_default = 1
          ORDER BY gp.regional_number IS NULL, gpd.sort_order, gp.regional_number, p.species_id`;
  const rows = (await db.all(query)) as {
    id: number;
    species_id: number;
    generation_id: number;
    name: string;
    types: string | null;
    number: number;
  }[];
  return rows.map((row) => ({
    pokemonId: row.id,
    speciesId: row.species_id,
    number: row.number,
    generationId: row.generation_id,
    name: row.name,
    types: row.types ? row.types.split(',') : [],
  }));
}

/** Capture flags of one Pokémon (and form) in a collection. */
export interface ChecklistFlags {
  readonly seen: boolean;
  readonly caught: boolean;
  readonly shinyCaught: boolean;
}

export interface ChecklistEntry extends ChecklistFlags {
  readonly pokemonId: number;
  /** 0 = default form, else pokemon_forms.id. */
  readonly formId: number;
}

/** Live (non-deleted) entries of a collection. */
export async function getChecklistEntries(
  db: AnySQLiteDatabase,
  dexScope: string,
): Promise<ChecklistEntry[]> {
  const rows = (await db.all(sql`
    SELECT pokemon_id, form_id, seen, caught, shiny_caught FROM checklist_entries
    WHERE dex_scope = ${dexScope} AND deleted_at IS NULL`)) as {
    pokemon_id: number;
    form_id: number;
    seen: number;
    caught: number;
    shiny_caught: number;
  }[];
  return rows.map((row) => ({
    pokemonId: row.pokemon_id,
    formId: row.form_id,
    seen: row.seen === 1,
    caught: row.caught === 1,
    shinyCaught: row.shiny_caught === 1,
  }));
}

/** Rows per INSERT, well under SQLite's bound-parameter limit. */
const BATCH_SIZE = 200;

/**
 * Upserts entries of a collection (one Pokémon or a whole box/generation, RF09.1) with the same
 * `updatedAt`, so sync merges them last-write-wins. Clearing a Pokémon stores all-false flags.
 */
export async function setChecklistEntries(
  db: AnySQLiteDatabase,
  dexScope: string,
  entries: readonly (ChecklistFlags & { readonly pokemonId: number; readonly formId?: number })[],
  updatedAt: number,
): Promise<void> {
  for (let start = 0; start < entries.length; start += BATCH_SIZE) {
    const values = entries.slice(start, start + BATCH_SIZE).map(
      (entry) =>
        sql`(${dexScope}, ${entry.pokemonId}, ${entry.formId ?? 0}, ${entry.seen ? 1 : 0},
            ${entry.caught ? 1 : 0}, ${entry.shinyCaught ? 1 : 0}, ${updatedAt}, NULL)`,
    );
    await db.run(sql`
      INSERT INTO checklist_entries (dex_scope, pokemon_id, form_id, seen, caught, shiny_caught,
        updated_at, deleted_at)
      VALUES ${sql.join(values, sql`, `)}
      ON CONFLICT (dex_scope, pokemon_id, form_id) DO UPDATE SET seen = excluded.seen,
        caught = excluded.caught, shiny_caught = excluded.shiny_caught,
        updated_at = excluded.updated_at, deleted_at = NULL`);
  }
}

/** Entries of `pokemonIds` only (profile, team slots): pokemon id → flags of the default form. */
export async function getChecklistFlags(
  db: AnySQLiteDatabase,
  dexScope: string,
  pokemonIds: readonly number[],
): Promise<Map<number, ChecklistFlags>> {
  if (pokemonIds.length === 0) return new Map();
  const rows = (await db.all(sql`
    SELECT pokemon_id, seen, caught, shiny_caught FROM checklist_entries
    WHERE dex_scope = ${dexScope} AND pokemon_id IN (${sqlList(pokemonIds)}) AND form_id = 0
      AND deleted_at IS NULL`)) as {
    pokemon_id: number;
    seen: number;
    caught: number;
    shiny_caught: number;
  }[];
  return new Map(
    rows.map((row) => [
      row.pokemon_id,
      { seen: row.seen === 1, caught: row.caught === 1, shinyCaught: row.shiny_caught === 1 },
    ]),
  );
}
