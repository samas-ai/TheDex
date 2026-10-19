import { sql } from 'drizzle-orm';
import type { AnySQLiteDatabase } from '../types';
import {
  exportBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  type RestoreResult,
} from './backup';

/**
 * Where a cloud provider keeps the user's data (Google Drive app folder, iCloud container…): one
 * `.thedex` snapshot per account. Providers only move text; merging is `syncUserData`'s job.
 */
export interface SyncTransport {
  /** Provider id stored in `sync_state` (`google-drive`, `icloud`…). */
  readonly provider: string;
  /** The remote snapshot, or null when there is none yet. */
  download(): Promise<string | null>;
  upload(content: string): Promise<void>;
}

export interface SyncState {
  /** Identifies this device to the provider; created on the first sync. */
  readonly deviceId: string;
  readonly lastSyncedAt: number | null;
}

export async function getSyncState(
  db: AnySQLiteDatabase,
  provider: string,
): Promise<SyncState | null> {
  const row = (await db.get(
    sql`SELECT device_id, last_synced_at FROM sync_state WHERE provider = ${provider}`,
  )) as { device_id: string; last_synced_at: number | null } | undefined;
  return row ? { deviceId: row.device_id, lastSyncedAt: row.last_synced_at } : null;
}

export interface SyncResult {
  /** What the remote snapshot changed here (null when the provider had none). */
  readonly pulled: RestoreResult | null;
  readonly syncedAt: number;
}

/**
 * One sync round (RNF06): merges the remote snapshot into thedex-user.db (last write wins,
 * tombstones included) and uploads the merged state, so both sides end with the same rows.
 * Running it again without changes writes nothing locally. A device that syncs between this
 * round's download and upload has its changes overwritten remotely, but keeps them locally and
 * uploads them again on its next round.
 */
export async function syncUserData(
  db: AnySQLiteDatabase,
  transport: SyncTransport,
  options: { readonly now: number; readonly deviceId: string },
): Promise<SyncResult> {
  const remote = await transport.download();
  const pulled =
    remote === null ? null : await restoreBackup(db, parseBackup(remote), 'merge', options.now);
  await transport.upload(serializeBackup(await exportBackup(db, options.now)));
  // The device id is kept from the first sync with this provider.
  await db.run(sql`
    INSERT INTO sync_state (provider, device_id, last_synced_at)
    VALUES (${transport.provider}, ${options.deviceId}, ${options.now})
    ON CONFLICT (provider) DO UPDATE SET last_synced_at = excluded.last_synced_at`);
  return { pulled, syncedAt: options.now };
}
