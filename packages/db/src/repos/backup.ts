import { sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { AnySQLiteDatabase } from '../types';
import { parseTeamMembers } from './teams';

/** `format` of a `.thedex` file (RNF06). */
export const BACKUP_FORMAT = 'thedex-backup';
/**
 * Bumped only for breaking changes. Additive fields keep the version: older apps drop what
 * they do not know (Zod strips unknown keys), newer ones read old files with the defaults.
 */
export const BACKUP_VERSION = 1;
export const BACKUP_EXTENSION = '.thedex';

const epochMs = z.number().int().nonnegative();
const deletedAt = epochMs.nullable().default(null);

const settingSchema = z.object({
  key: z.string().min(1).max(64),
  value: z.json(),
  updatedAt: epochMs,
});

const favoriteSchema = z.object({
  entityType: z.string().min(1).max(32),
  entityId: z.number().int().positive(),
  createdAt: epochMs,
  updatedAt: epochMs,
  deletedAt,
});

const teamSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(200),
  format: z.string().max(100).nullable().default(null),
  gameId: z.number().int().positive().nullable().default(null),
  generationId: z.number().int().positive(),
  /** Invalid members are dropped, like `decodeTeamMembers` does for the DB. */
  members: z.array(z.unknown()).transform(parseTeamMembers),
  notes: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
  createdAt: epochMs,
  updatedAt: epochMs,
  deletedAt,
});

const checklistEntrySchema = z.object({
  dexScope: z.string().min(1).max(64),
  pokemonId: z.number().int().positive(),
  formId: z.number().int().nonnegative().default(0),
  seen: z.boolean(),
  caught: z.boolean(),
  shinyCaught: z.boolean(),
  updatedAt: epochMs,
  deletedAt,
});

/**
 * `.thedex` backup: every row of the synced user tables (BACKUP_TABLES), tombstones included,
 * so restoring and syncing merge last-write-wins on `updatedAt`. Media cache and sync state are
 * device-local and never exported.
 */
export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().positive(),
  exportedAt: epochMs,
  data: z.object({
    settings: z.array(settingSchema).default([]),
    favorites: z.array(favoriteSchema).default([]),
    teams: z.array(teamSchema).default([]),
    checklistEntries: z.array(checklistEntrySchema).default([]),
  }),
});

export type Backup = z.output<typeof backupSchema>;
export type BackupData = Backup['data'];
export type BackupTable = keyof BackupData;
export const BACKUP_DATA_TABLES: readonly BackupTable[] = [
  'settings',
  'favorites',
  'teams',
  'checklistEntries',
];

export type BackupErrorCode = 'invalid-json' | 'not-a-backup' | 'newer-version' | 'invalid-data';

/** Why a file could not be read as a backup; `code` is what the UI explains. */
export class BackupError extends Error {
  constructor(
    readonly code: BackupErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

/** Reads a `.thedex` file, validating it with Zod. Throws `BackupError`. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new BackupError('invalid-json', e instanceof Error ? e.message : String(e));
  }
  if (typeof raw !== 'object' || raw === null || !('format' in raw)) {
    throw new BackupError('not-a-backup', 'Missing "format"');
  }
  if (raw.format !== BACKUP_FORMAT) {
    throw new BackupError('not-a-backup', `Unknown format ${JSON.stringify(raw.format)}`);
  }
  if ('version' in raw && typeof raw.version === 'number' && raw.version > BACKUP_VERSION) {
    throw new BackupError('newer-version', `Backup version ${raw.version} > ${BACKUP_VERSION}`);
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join('.') ?? '';
    throw new BackupError('invalid-data', `${where}: ${issue?.message ?? 'invalid'}`);
  }
  return parsed.data;
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup);
}

interface SettingRow {
  key: string;
  value_json: string;
  updated_at: number;
}
interface FavoriteRow {
  entity_type: string;
  entity_id: number;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
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
  deleted_at: number | null;
}
interface ChecklistRow {
  dex_scope: string;
  pokemon_id: number;
  form_id: number;
  seen: number;
  caught: number;
  shiny_caught: number;
  updated_at: number;
  deleted_at: number | null;
}

type JsonValue = z.output<typeof settingSchema>['value'];

function parseJson(text: string): { ok: true; value: JsonValue } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as JsonValue };
  } catch {
    return { ok: false };
  }
}

/** Snapshot of the user data (RNF06), in a stable order. Corrupt setting values are skipped. */
export async function exportBackup(db: AnySQLiteDatabase, exportedAt: number): Promise<Backup> {
  const settings = (await db.all(
    sql`SELECT key, value_json, updated_at FROM settings ORDER BY key`,
  )) as SettingRow[];
  const favorites = (await db.all(sql`
    SELECT entity_type, entity_id, created_at, updated_at, deleted_at FROM favorites
    ORDER BY entity_type, entity_id`)) as FavoriteRow[];
  const teams = (await db.all(sql`
    SELECT id, name, format, game_id, generation_id, members_json, notes, sort_order, created_at,
      updated_at, deleted_at
    FROM teams ORDER BY id`)) as TeamRow[];
  const checklist = (await db.all(sql`
    SELECT dex_scope, pokemon_id, form_id, seen, caught, shiny_caught, updated_at, deleted_at
    FROM checklist_entries ORDER BY dex_scope, pokemon_id, form_id`)) as ChecklistRow[];

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    data: {
      settings: settings.flatMap((row) => {
        const parsed = parseJson(row.value_json);
        return parsed.ok ? [{ key: row.key, value: parsed.value, updatedAt: row.updated_at }] : [];
      }),
      favorites: favorites.map((row) => ({
        entityType: row.entity_type,
        entityId: row.entity_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
      })),
      teams: teams.map((row) => {
        let members: unknown = [];
        try {
          members = JSON.parse(row.members_json);
        } catch {
          // Unreadable members: the team is kept, empty (as listTeams shows it).
        }
        return {
          id: row.id,
          name: row.name,
          format: row.format,
          gameId: row.game_id,
          generationId: row.generation_id,
          members: parseTeamMembers(members),
          notes: row.notes,
          sortOrder: row.sort_order,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          deletedAt: row.deleted_at,
        };
      }),
      checklistEntries: checklist.map((row) => ({
        dexScope: row.dex_scope,
        pokemonId: row.pokemon_id,
        formId: row.form_id,
        seen: row.seen === 1,
        caught: row.caught === 1,
        shinyCaught: row.shiny_caught === 1,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
      })),
    },
  };
}

/** What a backup holds (live rows only), to show before restoring. */
export interface BackupSummary {
  readonly exportedAt: number;
  readonly settings: number;
  readonly favorites: number;
  readonly teams: number;
  /** Checklist marks (at least "seen"), across every collection. */
  readonly checklistEntries: number;
}

export function summarizeBackup(backup: Backup): BackupSummary {
  const { data } = backup;
  return {
    exportedAt: backup.exportedAt,
    settings: data.settings.length,
    favorites: data.favorites.filter((row) => row.deletedAt === null).length,
    teams: data.teams.filter((row) => row.deletedAt === null).length,
    checklistEntries: data.checklistEntries.filter(
      (row) => row.deletedAt === null && (row.seen || row.caught || row.shinyCaught),
    ).length,
  };
}

/**
 * - `merge`: last write wins per row (the newer `updatedAt` stays, tombstones included). Safe to
 *   repeat; it is also how sync applies a remote snapshot.
 * - `replace`: the backup's live rows become the current state and every other live row is
 *   deleted (tombstoned). Rows are stamped with the restore time, so the restore also wins the
 *   next sync — this is how a deleted team comes back from an older backup.
 */
export type RestoreMode = 'merge' | 'replace';

export interface TableRestoreResult {
  /** Rows written live (new or newer than this device's). */
  readonly restored: number;
  /** Rows that were live here and are deleted now. */
  readonly removed: number;
  /** Backup rows ignored because this device has the same or a newer version. */
  readonly skipped: number;
}

export type RestoreResult = Readonly<Record<BackupTable, TableRestoreResult>>;

interface Stamp {
  readonly updatedAt: number;
  readonly deletedAt: number | null;
}

/** Rows to write for one table, and the counts the UI reports. */
function planTable<Row extends Stamp>(
  incoming: readonly Row[],
  keyOf: (row: Row) => string,
  local: ReadonlyMap<string, Stamp>,
  mode: RestoreMode,
  stamp: number,
  /** False for settings: they have no tombstones, so a replace keeps keys the backup lacks. */
  deletes = true,
): { writes: Row[]; result: TableRestoreResult } {
  // A file edited by hand may repeat a key: its newest row counts.
  const latest = new Map<string, Row>();
  for (const row of incoming) {
    const key = keyOf(row);
    const seen = latest.get(key);
    if (!seen || row.updatedAt > seen.updatedAt) latest.set(key, row);
  }
  const writes: Row[] = [];
  let restored = 0;
  let removed = 0;
  let skipped = 0;
  if (mode === 'merge') {
    for (const [key, row] of latest) {
      const current = local.get(key);
      if (current && row.updatedAt <= current.updatedAt) {
        skipped++;
        continue;
      }
      writes.push(row);
      if (row.deletedAt === null) restored++;
      else if (current?.deletedAt === null) removed++;
    }
  } else {
    const kept = new Set<string>();
    for (const [key, row] of latest) {
      if (row.deletedAt !== null) continue;
      kept.add(key);
      writes.push({ ...row, updatedAt: stamp, deletedAt: null });
      restored++;
    }
    if (deletes) {
      for (const [key, current] of local) {
        if (current.deletedAt === null && !kept.has(key)) removed++;
      }
    }
  }
  return { writes, result: { restored, removed, skipped } };
}

/** Rows per INSERT, well under SQLite's bound-parameter limit. */
const BATCH_SIZE = 200;

async function upsertBatches<Row>(
  db: AnySQLiteDatabase,
  rows: readonly Row[],
  values: (row: Row) => SQL,
  statement: (values: SQL) => SQL,
): Promise<void> {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE).map(values);
    await db.run(statement(sql.join(batch, sql`, `)));
  }
}

const favoriteKey = (row: { entityType: string; entityId: number }) =>
  JSON.stringify([row.entityType, row.entityId]);
const checklistKey = (row: { dexScope: string; pokemonId: number; formId: number }) =>
  JSON.stringify([row.dexScope, row.pokemonId, row.formId]);

/** Current `updated_at`/`deleted_at` of every row, keyed like the backup rows. */
async function localStamps(db: AnySQLiteDatabase) {
  const settings = (await db.all(sql`SELECT key, updated_at FROM settings`)) as {
    key: string;
    updated_at: number;
  }[];
  const favorites = (await db.all(
    sql`SELECT entity_type, entity_id, updated_at, deleted_at FROM favorites`,
  )) as FavoriteRow[];
  const teams = (await db.all(sql`SELECT id, updated_at, deleted_at FROM teams`)) as TeamRow[];
  const checklist = (await db.all(sql`
    SELECT dex_scope, pokemon_id, form_id, updated_at, deleted_at FROM checklist_entries`)) as ChecklistRow[];
  const stamp = (row: { updated_at: number; deleted_at?: number | null }): Stamp => ({
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? null,
  });
  return {
    settings: new Map(settings.map((row) => [row.key, stamp(row)])),
    favorites: new Map(
      favorites.map((row) => [
        favoriteKey({ entityType: row.entity_type, entityId: row.entity_id }),
        stamp(row),
      ]),
    ),
    teams: new Map(teams.map((row) => [row.id, stamp(row)])),
    checklistEntries: new Map(
      checklist.map((row) => [
        checklistKey({ dexScope: row.dex_scope, pokemonId: row.pokemon_id, formId: row.form_id }),
        stamp(row),
      ]),
    ),
  };
}

/** Runs `work` in one transaction: a failed restore leaves the user data untouched. */
async function inTransaction<T>(db: AnySQLiteDatabase, work: () => Promise<T>): Promise<T> {
  await db.run(sql`BEGIN IMMEDIATE`);
  try {
    const result = await work();
    await db.run(sql`COMMIT`);
    return result;
  } catch (e) {
    await db.run(sql`ROLLBACK`);
    throw e;
  }
}

/**
 * Restores a backup into thedex-user.db (RNF06) in one transaction; see `RestoreMode`. `now`
 * stamps a replace (raised above any stored `updatedAt`, so the restore is the newest write
 * even after clock skew between devices).
 */
export async function restoreBackup(
  db: AnySQLiteDatabase,
  backup: Backup,
  mode: RestoreMode,
  now: number,
): Promise<RestoreResult> {
  return inTransaction(db, async () => {
    const local = await localStamps(db);
    let newest = 0;
    for (const table of Object.values(local)) {
      for (const row of table.values()) newest = Math.max(newest, row.updatedAt);
    }
    const stamp = Math.max(now, newest + 1);
    const { data } = backup;

    const settings = planTable(
      data.settings.map((row) => ({ ...row, deletedAt: null })),
      (row) => row.key,
      local.settings,
      mode,
      stamp,
      false,
    );
    const favorites = planTable(data.favorites, favoriteKey, local.favorites, mode, stamp);
    const teams = planTable(data.teams, (row) => row.id, local.teams, mode, stamp);
    const checklist = planTable(
      data.checklistEntries,
      checklistKey,
      local.checklistEntries,
      mode,
      stamp,
    );

    if (mode === 'replace') {
      // Settings have no tombstones: keys missing from the backup keep their value.
      for (const table of ['favorites', 'teams', 'checklist_entries']) {
        await db.run(sql`UPDATE ${sql.identifier(table)} SET deleted_at = ${stamp},
          updated_at = ${stamp} WHERE deleted_at IS NULL`);
      }
    }

    await upsertBatches(
      db,
      settings.writes,
      (row) => sql`(${row.key}, ${JSON.stringify(row.value)}, ${row.updatedAt})`,
      (values) => sql`INSERT INTO settings (key, value_json, updated_at) VALUES ${values}
        ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json,
          updated_at = excluded.updated_at`,
    );
    await upsertBatches(
      db,
      favorites.writes,
      (row) =>
        sql`(${row.entityType}, ${row.entityId}, ${row.createdAt}, ${row.updatedAt}, ${row.deletedAt})`,
      (values) => sql`INSERT INTO favorites (entity_type, entity_id, created_at, updated_at,
          deleted_at) VALUES ${values}
        ON CONFLICT (entity_type, entity_id) DO UPDATE SET created_at = excluded.created_at,
          updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
    );
    await upsertBatches(
      db,
      teams.writes,
      (row) => sql`(${row.id}, ${row.name}, ${row.format}, ${row.gameId}, ${row.generationId},
        ${JSON.stringify(row.members)}, ${row.notes}, ${row.sortOrder}, ${row.createdAt},
        ${row.updatedAt}, ${row.deletedAt})`,
      (values) => sql`INSERT INTO teams (id, name, format, game_id, generation_id, members_json,
          notes, sort_order, created_at, updated_at, deleted_at) VALUES ${values}
        ON CONFLICT (id) DO UPDATE SET name = excluded.name, format = excluded.format,
          game_id = excluded.game_id, generation_id = excluded.generation_id,
          members_json = excluded.members_json, notes = excluded.notes,
          sort_order = excluded.sort_order, created_at = excluded.created_at,
          updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
    );
    await upsertBatches(
      db,
      checklist.writes,
      (row) => sql`(${row.dexScope}, ${row.pokemonId}, ${row.formId}, ${row.seen ? 1 : 0},
        ${row.caught ? 1 : 0}, ${row.shinyCaught ? 1 : 0}, ${row.updatedAt}, ${row.deletedAt})`,
      (values) => sql`INSERT INTO checklist_entries (dex_scope, pokemon_id, form_id, seen, caught,
          shiny_caught, updated_at, deleted_at) VALUES ${values}
        ON CONFLICT (dex_scope, pokemon_id, form_id) DO UPDATE SET seen = excluded.seen,
          caught = excluded.caught, shiny_caught = excluded.shiny_caught,
          updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
    );

    return {
      settings: settings.result,
      favorites: favorites.result,
      teams: teams.result,
      checklistEntries: checklist.result,
    };
  });
}
