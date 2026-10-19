import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupError,
  exportBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  summarizeBackup,
  type Backup,
} from '../src/repos/backup';
import {
  getChecklistEntries,
  setChecklistEntries,
  type ChecklistFlags,
} from '../src/repos/checklist';
import { readSettings, writeSetting } from '../src/repos/settings';
import { getSyncState, syncUserData, type SyncTransport } from '../src/repos/sync';
import { deleteTeam, getTeam, listTeams, newTeamMember, saveTeam } from '../src/repos/teams';
import { userSchemaStatements } from '../src/schema/user/statements';

function userDb() {
  const sqlite = new Database(':memory:');
  for (const statement of userSchemaStatements()) sqlite.exec(statement);
  return { sqlite, db: drizzle(sqlite) };
}

const team = (id: string, name: string, members = [newTeamMember(445)]) => ({
  id,
  name,
  format: 'gen9ou',
  gameId: 25,
  generationId: 9,
  members,
  notes: null,
  sortOrder: 0,
  createdAt: 100,
});

const CAUGHT: ChecklistFlags = { seen: true, caught: true, shinyCaught: false };

function backupOf(data: Partial<Backup['data']>, exportedAt = 1): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    data: { settings: [], favorites: [], teams: [], checklistEntries: [], ...data },
  };
}

describe('exportBackup', () => {
  it('snapshots every synced table with tombstones, in a stable order', async () => {
    const { sqlite, db } = userDb();
    await writeSetting(db, 'theme', 'dark', 10);
    sqlite
      .prepare(`INSERT INTO settings (key, value_json, updated_at) VALUES ('broken', '{', 1)`)
      .run();
    sqlite
      .prepare(
        `INSERT INTO favorites (entity_type, entity_id, created_at, updated_at, deleted_at)
         VALUES ('pokemon', 25, 1, 2, NULL), ('move', 85, 1, 3, 3)`,
      )
      .run();
    await saveTeam(db, team('B', 'Rain'), 20);
    await saveTeam(db, team('A', 'Sun'), 20);
    await deleteTeam(db, 'A', 30);
    await setChecklistEntries(db, 'national', [{ pokemonId: 25, ...CAUGHT }], 40);
    sqlite.prepare(`INSERT INTO media_cache VALUES ('k', 'sprite', 'u', 'l', 1, NULL, 1, 1)`).run();

    const backup = await exportBackup(db, 99);
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.exportedAt).toBe(99);
    expect(backup.data.settings).toEqual([{ key: 'theme', value: 'dark', updatedAt: 10 }]);
    expect(backup.data.favorites.map((f) => [f.entityType, f.deletedAt])).toEqual([
      ['move', 3],
      ['pokemon', null],
    ]);
    expect(backup.data.teams.map((t) => [t.id, t.deletedAt])).toEqual([
      ['A', 30],
      ['B', null],
    ]);
    expect(backup.data.teams[1]?.members[0]?.pokemonId).toBe(445);
    expect(backup.data.checklistEntries).toEqual([
      {
        dexScope: 'national',
        pokemonId: 25,
        formId: 0,
        ...CAUGHT,
        updatedAt: 40,
        deletedAt: null,
      },
    ]);
    // Round trip through the file format.
    expect(parseBackup(serializeBackup(backup))).toEqual(backup);
  });

  it('keeps a team whose members are unreadable, empty', async () => {
    const { sqlite, db } = userDb();
    sqlite
      .prepare(
        `INSERT INTO teams (id, name, generation_id, members_json, created_at, updated_at)
         VALUES ('X', 'Broken', 9, 'not json', 1, 1)`,
      )
      .run();
    const backup = await exportBackup(db, 1);
    expect(backup.data.teams[0]?.members).toEqual([]);
  });
});

describe('parseBackup', () => {
  const expectCode = (text: string, code: string) => {
    try {
      parseBackup(text);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(BackupError);
      expect((e as BackupError).code).toBe(code);
    }
  };

  it('explains why a file is not a usable backup', () => {
    expectCode('{', 'invalid-json');
    expectCode('[]', 'not-a-backup');
    expectCode('null', 'not-a-backup');
    expectCode(JSON.stringify({ format: 'showdown' }), 'not-a-backup');
    expectCode(JSON.stringify({ ...backupOf({}), version: BACKUP_VERSION + 1 }), 'newer-version');
    expectCode(
      JSON.stringify(backupOf({ teams: [{ id: 'A' } as unknown as Backup['data']['teams'][0]] })),
      'invalid-data',
    );
    expectCode(
      JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: 1 }),
      'invalid-data',
    );
  });

  it('fills defaults, ignores unknown fields and drops invalid team members', () => {
    const backup = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        exportedAt: 5,
        addedLater: true,
        data: {
          teams: [
            {
              id: 'A',
              name: 'Sun',
              generationId: 9,
              members: [{ pokemonId: 6 }, { pokemonId: -1 }, 'junk'],
              createdAt: 1,
              updatedAt: 2,
            },
          ],
        },
      }),
    );
    expect(backup).not.toHaveProperty('addedLater');
    expect(backup.data.settings).toEqual([]);
    expect(backup.data.teams[0]).toMatchObject({ format: null, sortOrder: 0, deletedAt: null });
    expect(backup.data.teams[0]?.members).toEqual([newTeamMember(6)]);
  });
});

describe('summarizeBackup', () => {
  it('counts live rows and checklist marks', () => {
    const entry = { dexScope: 'national', formId: 0, updatedAt: 1, deletedAt: null };
    const summary = summarizeBackup(
      backupOf(
        {
          settings: [{ key: 'theme', value: 'dark', updatedAt: 1 }],
          teams: [
            { ...team('A', 'Sun'), updatedAt: 1, deletedAt: null },
            { ...team('B', 'Old'), updatedAt: 1, deletedAt: 1 },
          ],
          checklistEntries: [
            { ...entry, pokemonId: 1, ...CAUGHT },
            { ...entry, pokemonId: 2, seen: false, caught: false, shinyCaught: false },
            { ...entry, pokemonId: 3, ...CAUGHT, deletedAt: 1 },
          ],
        },
        7,
      ),
    );
    expect(summary).toEqual({
      exportedAt: 7,
      settings: 1,
      favorites: 0,
      teams: 1,
      checklistEntries: 1,
    });
  });
});

describe('restoreBackup', () => {
  it('merges last-write-wins per row, tombstones included, and is idempotent', async () => {
    const source = userDb();
    await writeSetting(source.db, 'theme', 'amoled', 50);
    await writeSetting(source.db, 'game_id', 3, 5);
    await saveTeam(source.db, team('A', 'Sun v2'), 50);
    await saveTeam(source.db, team('B', 'Old name'), 5);
    await saveTeam(source.db, team('C', 'Deleted there'), 5);
    await deleteTeam(source.db, 'C', 60);
    await saveTeam(source.db, team('D', 'Only there'), 5);
    const backup = parseBackup(serializeBackup(await exportBackup(source.db, 70)));

    const { db } = userDb();
    await writeSetting(db, 'theme', 'light', 10);
    await writeSetting(db, 'game_id', 7, 10);
    await saveTeam(db, team('A', 'Sun v1'), 10);
    await saveTeam(db, team('B', 'New name'), 10);
    await saveTeam(db, team('C', 'Deleted there'), 10);

    const result = await restoreBackup(db, backup, 'merge', 1000);
    expect(result.settings).toEqual({ restored: 1, removed: 0, skipped: 1 });
    expect(result.teams).toEqual({ restored: 2, removed: 1, skipped: 1 });
    expect(await readSettings(db)).toEqual({ theme: 'amoled', game_id: 7 });
    expect((await listTeams(db)).map((t) => t.name)).toEqual(['Sun v2', 'New name', 'Only there']);
    // Merged rows keep their own timestamps (no restore stamp).
    expect((await getTeam(db, 'A'))?.updatedAt).toBe(50);

    const again = await restoreBackup(db, backup, 'merge', 2000);
    expect(again.teams).toEqual({ restored: 0, removed: 0, skipped: 4 });
    expect(again.settings).toEqual({ restored: 0, removed: 0, skipped: 2 });
  });

  it('replaces the live state, bringing back rows deleted after the backup', async () => {
    const { sqlite, db } = userDb();
    await saveTeam(db, team('A', 'Sun'), 10);
    await setChecklistEntries(db, 'national', [{ pokemonId: 25, ...CAUGHT }], 10);
    await writeSetting(db, 'theme', 'dark', 10);
    const backup = await exportBackup(db, 20);

    await deleteTeam(db, 'A', 30);
    await saveTeam(db, team('B', 'After the backup'), 30);
    await setChecklistEntries(db, 'national', [{ pokemonId: 4, ...CAUGHT }], 30);
    await writeSetting(db, 'theme', 'light', 30);
    await writeSetting(db, 'sprite_style', 'pixel', 30);
    // A row from a device whose clock runs ahead.
    await setChecklistEntries(db, 'game:1', [{ pokemonId: 1, ...CAUGHT }], 5000);

    // Merging cannot undo the newer deletion…
    expect((await restoreBackup(db, backup, 'merge', 100)).teams.restored).toBe(0);
    // …replacing can.
    const result = await restoreBackup(db, backup, 'replace', 100);
    expect(result.teams).toEqual({ restored: 1, removed: 1, skipped: 0 });
    expect(result.checklistEntries).toEqual({ restored: 1, removed: 2, skipped: 0 });
    expect(result.settings).toEqual({ restored: 1, removed: 0, skipped: 0 });

    expect((await listTeams(db)).map((t) => t.name)).toEqual(['Sun']);
    expect((await getChecklistEntries(db, 'national')).map((e) => e.pokemonId)).toEqual([25]);
    expect(await getChecklistEntries(db, 'game:1')).toEqual([]);
    // Settings the backup lacks keep their value.
    expect(await readSettings(db)).toEqual({ theme: 'dark', sprite_style: 'pixel' });
    // Every changed row is stamped above the newest stored write, so it wins the next sync.
    const stamps = sqlite
      .prepare(
        `SELECT DISTINCT updated_at FROM teams UNION SELECT updated_at FROM checklist_entries`,
      )
      .pluck()
      .all();
    expect(stamps).toEqual([5001]);
  });

  it('writes large collections in batches', async () => {
    const { db } = userDb();
    const entries = Array.from({ length: 450 }, (_, i) => ({
      dexScope: 'national',
      pokemonId: i + 1,
      formId: 0,
      ...CAUGHT,
      updatedAt: 1,
      deletedAt: null,
    }));
    const result = await restoreBackup(db, backupOf({ checklistEntries: entries }), 'merge', 2);
    expect(result.checklistEntries.restored).toBe(450);
    expect(await getChecklistEntries(db, 'national')).toHaveLength(450);
  });

  it('keeps the latest copy of a key repeated in the file', async () => {
    const { db } = userDb();
    const row = (name: string, updatedAt: number) => ({
      ...team('A', name),
      updatedAt,
      deletedAt: null,
    });
    await restoreBackup(db, backupOf({ teams: [row('New', 9), row('Old', 2)] }), 'merge', 10);
    expect((await getTeam(db, 'A'))?.name).toBe('New');
  });

  it('rolls everything back when a write fails', async () => {
    const { sqlite, db } = userDb();
    await writeSetting(db, 'theme', 'dark', 1);
    sqlite.exec('DROP TABLE checklist_entries');
    // Same columns, but every insert fails — after the settings were written.
    sqlite.exec(`CREATE TABLE checklist_entries (dex_scope TEXT, pokemon_id INTEGER,
      form_id INTEGER, seen INTEGER, caught INTEGER, shiny_caught INTEGER, updated_at INTEGER,
      deleted_at INTEGER, PRIMARY KEY (dex_scope, pokemon_id, form_id), CHECK (pokemon_id > 1000))`);
    const backup = backupOf({
      settings: [{ key: 'theme', value: 'light', updatedAt: 5 }],
      checklistEntries: [
        { dexScope: 'national', pokemonId: 1, formId: 0, ...CAUGHT, updatedAt: 5, deletedAt: null },
      ],
    });
    await expect(restoreBackup(db, backup, 'merge', 10)).rejects.toThrow();
    expect(await readSettings(db)).toEqual({ theme: 'dark' });
    // The connection is usable again (no transaction left open).
    await writeSetting(db, 'theme', 'amoled', 20);
  });
});

describe('syncUserData', () => {
  function memoryCloud(): SyncTransport & { content: string | null } {
    return {
      provider: 'memory',
      content: null,
      async download() {
        return this.content;
      },
      async upload(content: string) {
        this.content = content;
      },
    };
  }

  it('converges two devices through one remote snapshot', async () => {
    const cloud = memoryCloud();
    const phone = userDb();
    const tablet = userDb();
    await saveTeam(phone.db, team('A', 'From the phone'), 10);
    await saveTeam(tablet.db, team('B', 'From the tablet'), 20);
    await setChecklistEntries(tablet.db, 'national', [{ pokemonId: 25, ...CAUGHT }], 20);

    const first = await syncUserData(phone.db, cloud, { now: 100, deviceId: 'PHONE' });
    expect(first.pulled).toBeNull();
    const second = await syncUserData(tablet.db, cloud, { now: 200, deviceId: 'TABLET' });
    expect(second.pulled?.teams.restored).toBe(1);
    await deleteTeam(tablet.db, 'A', 210);
    await syncUserData(tablet.db, cloud, { now: 220, deviceId: 'TABLET' });
    const third = await syncUserData(phone.db, cloud, { now: 300, deviceId: 'OTHER' });
    expect(third.pulled?.teams).toEqual({ restored: 1, removed: 1, skipped: 0 });

    for (const device of [phone, tablet]) {
      expect((await listTeams(device.db)).map((t) => t.id)).toEqual(['B']);
      expect(await getChecklistEntries(device.db, 'national')).toHaveLength(1);
    }
    // The device id is the one from the first sync with the provider.
    expect(await getSyncState(phone.db, 'memory')).toEqual({
      deviceId: 'PHONE',
      lastSyncedAt: 300,
    });
    expect(await getSyncState(phone.db, 'icloud')).toBeNull();

    const idle = await syncUserData(phone.db, cloud, { now: 400, deviceId: 'PHONE' });
    expect(Object.values(idle.pulled ?? {}).every((t) => t.restored + t.removed === 0)).toBe(true);
  });
});
