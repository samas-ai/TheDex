import { sql } from 'drizzle-orm';
import { NATURE_NAMES, TYPE_NAMES } from '@thedex/engine';
import { z } from 'zod';
import type { AnySQLiteDatabase } from '../types';

/** Teams hold up to six Pokémon (RF08.1). */
export const TEAM_SIZE = 6;
/** Moves per Pokémon. */
export const MOVE_SLOTS = 4;

const ev = z.number().int().min(0).max(255);
const iv = z.number().int().min(0).max(31);
const statsOf = (value: z.ZodNumber, fill: number) =>
  z
    .object({ hp: value, atk: value, def: value, spa: value, spd: value, spe: value })
    .default({ hp: fill, atk: fill, def: fill, spa: fill, spd: fill, spe: fill });

/**
 * One team slot (RF08.2) as stored in `teams.members_json`: PokeAPI ids for everything with an
 * entity (variety, ability, item, moves) and Showdown's conventions for the rest — EVs 0–255,
 * IVs 0–31 in every generation (DV = ⌊IV / 2⌋ in Gen 1–2) — so it exports as a PokemonSet.
 */
export const teamMemberSchema = z.object({
  pokemonId: z.number().int().positive(),
  /** '' = no nickname. */
  nickname: z.string().max(40).default(''),
  level: z.number().int().min(1).max(100).default(100),
  gender: z.enum(['', 'M', 'F']).default(''),
  shiny: z.boolean().default(false),
  abilityId: z.number().int().positive().nullable().default(null),
  nature: z.enum(NATURE_NAMES).nullable().default(null),
  itemId: z.number().int().positive().nullable().default(null),
  /** Type identifier or `stellar` (Gen 9). */
  teraType: z
    .enum([...TYPE_NAMES, 'stellar'])
    .nullable()
    .default(null),
  /** Move ids by slot; null = empty slot. */
  moveIds: z.array(z.number().int().positive().nullable()).max(MOVE_SLOTS).default([]),
  evs: statsOf(ev, 0),
  ivs: statsOf(iv, 31),
  happiness: z.number().int().min(0).max(255).default(255),
  /** Hidden Power type (Gen 2–7), when chosen explicitly. */
  hpType: z.enum(TYPE_NAMES).nullable().default(null),
  gigantamax: z.boolean().default(false),
  dynamaxLevel: z.number().int().min(0).max(10).default(10),
});

export type TeamMember = z.infer<typeof teamMemberSchema>;
export type TeamMemberInput = z.input<typeof teamMemberSchema>;

/** A new slot with the defaults (Lv. 100, IVs 31, no EVs). */
export function newTeamMember(pokemonId: number): TeamMember {
  return teamMemberSchema.parse({ pokemonId });
}

/**
 * Decodes `members_json`, written by this or another app version (sync, backups): invalid
 * members are dropped instead of failing the whole team; at most six are kept.
 */
export function decodeTeamMembers(json: string): TeamMember[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const members: TeamMember[] = [];
  for (const item of raw) {
    const parsed = teamMemberSchema.safeParse(item);
    if (parsed.success) members.push(parsed.data);
  }
  return members.slice(0, TEAM_SIZE);
}

export interface Team {
  /** ULID. */
  readonly id: string;
  readonly name: string;
  /** Showdown format id (`gen9ou`) or free text. */
  readonly format: string | null;
  /** Curated game the team is built for (RF08.1); null = only its generation. */
  readonly gameId: number | null;
  readonly generationId: number;
  readonly members: readonly TeamMember[];
  readonly notes: string | null;
  readonly sortOrder: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

interface TeamRow {
  id: string;
  name: string;
  format: string | null;
  game_id: number | null;
  generation_id: number;
  members_json: string;
  notes: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

function toTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    format: row.format,
    gameId: row.game_id,
    generationId: row.generation_id,
    members: decodeTeamMembers(row.members_json),
    notes: row.notes,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const TEAM_COLUMNS = sql.raw(
  'id, name, format, game_id, generation_id, members_json, notes, sort_order, created_at, updated_at',
);

/** Teams that are not deleted, in the user's order (then oldest first). */
export async function listTeams(db: AnySQLiteDatabase): Promise<Team[]> {
  const rows = (await db.all(sql`
    SELECT ${TEAM_COLUMNS} FROM teams WHERE deleted_at IS NULL
    ORDER BY sort_order, created_at, id`)) as TeamRow[];
  return rows.map(toTeam);
}

export async function getTeam(db: AnySQLiteDatabase, id: string): Promise<Team | null> {
  const row = (await db.get(sql`
    SELECT ${TEAM_COLUMNS} FROM teams WHERE id = ${id} AND deleted_at IS NULL`)) as
    TeamRow | undefined;
  return row ? toTeam(row) : null;
}

/**
 * Inserts or replaces a team (the unit of sync: last write wins on `updatedAt`). Members are
 * validated first; saving a deleted team's id brings it back.
 */
export async function saveTeam(
  db: AnySQLiteDatabase,
  team: Omit<Team, 'updatedAt'>,
  updatedAt: number,
): Promise<void> {
  if (team.members.length > TEAM_SIZE) {
    throw new RangeError(`A team has at most ${TEAM_SIZE} members`);
  }
  const members = JSON.stringify(team.members.map((member) => teamMemberSchema.parse(member)));
  await db.run(sql`
    INSERT INTO teams (id, name, format, game_id, generation_id, members_json, notes, sort_order,
      created_at, updated_at, deleted_at)
    VALUES (${team.id}, ${team.name}, ${team.format}, ${team.gameId}, ${team.generationId},
      ${members}, ${team.notes}, ${team.sortOrder}, ${team.createdAt}, ${updatedAt}, NULL)
    ON CONFLICT (id) DO UPDATE SET name = excluded.name, format = excluded.format,
      game_id = excluded.game_id, generation_id = excluded.generation_id,
      members_json = excluded.members_json, notes = excluded.notes,
      sort_order = excluded.sort_order, updated_at = excluded.updated_at, deleted_at = NULL`);
}

/** Deletes a team with a tombstone, so the deletion syncs (RNF06). */
export async function deleteTeam(db: AnySQLiteDatabase, id: string, now: number): Promise<void> {
  await db.run(sql`UPDATE teams SET deleted_at = ${now}, updated_at = ${now} WHERE id = ${id}`);
}

/** Next `sort_order` (teams are appended at the end). */
export async function nextTeamSortOrder(db: AnySQLiteDatabase): Promise<number> {
  const row = (await db.get(
    sql`SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM teams WHERE deleted_at IS NULL`,
  )) as { next: number };
  return row.next;
}
