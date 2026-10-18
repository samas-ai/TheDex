import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import {
  defaultDatabaseDirectory,
  importDatabaseFromAssetAsync,
  openDatabaseSync,
  type SQLiteDatabase,
} from 'expo-sqlite';
import { DATA_VERSION } from '@thedex/db';
import { userMigrations } from '@thedex/db/user';
import dataAsset from '../../../assets/db/thedex-data.db';

export const DATA_DB_NAME = 'thedex-data.db';
export const USER_DB_NAME = 'thedex-user.db';

export interface AppDatabase {
  /** User DB connection with the game DB attached as `data` — repositories use this. */
  readonly db: ExpoSQLiteDatabase;
  readonly sqlite: SQLiteDatabase;
  readonly dataVersion: string;
  /** True when this launch (re)installed the game DB from the bundled asset. */
  readonly installedNow: boolean;
}

function readInstalledDataVersion(): string | null {
  let db: SQLiteDatabase | null = null;
  try {
    db = openDatabaseSync(DATA_DB_NAME);
    const row = db.getFirstSync<{ value: string }>(
      `SELECT value FROM meta WHERE key = 'data_version'`,
    );
    return row?.value ?? null;
  } catch {
    // Missing or empty file: no installed game data yet.
    return null;
  } finally {
    db?.closeSync();
  }
}

/** `defaultDatabaseDirectory` may be a file:// URI; ATTACH needs a plain filesystem path. */
function toFilePath(directory: string): string {
  return decodeURIComponent(directory.replace(/^file:\/\//, ''));
}

/**
 * Opens both databases (CLAUDE.md, "Dois bancos SQLite"):
 * 1. copies the bundled thedex-data.db when the bundle's DATA_VERSION differs from the
 *    installed copy (new app version = new game data, user data untouched);
 * 2. opens thedex-user.db and applies pending migrations;
 * 3. ATTACHes the game DB so game queries work unqualified and joins span both DBs.
 */
export async function openAppDatabase(): Promise<AppDatabase> {
  const installed = readInstalledDataVersion();
  const installedNow = installed !== DATA_VERSION;
  if (installedNow) {
    // Exported by expo-sqlite (used by SQLiteProvider's assetSource); copies via expo-asset.
    await importDatabaseFromAssetAsync(DATA_DB_NAME, { assetId: dataAsset, forceOverwrite: true });
  }

  const sqlite = openDatabaseSync(USER_DB_NAME);
  const db = drizzle(sqlite);
  await migrate(db, userMigrations);

  const dataPath = `${toFilePath(String(defaultDatabaseDirectory))}/${DATA_DB_NAME}`;
  sqlite.execSync(`ATTACH DATABASE '${dataPath.replaceAll("'", "''")}' AS data`);

  return { db, sqlite, dataVersion: DATA_VERSION, installedNow };
}
