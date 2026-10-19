import { BACKUP_DATA_TABLES, BACKUP_EXTENSION, type RestoreResult } from '@thedex/db';

const pad = (value: number) => String(value).padStart(2, '0');

/** `thedex-backup-2026-10-19-0852.thedex`, in local time (sorts by date in a file list). */
export function backupFileName(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `thedex-backup-${day}-${pad(date.getHours())}${pad(date.getMinutes())}${BACKUP_EXTENSION}`;
}

export interface RestoreTotals {
  readonly restored: number;
  readonly removed: number;
  readonly skipped: number;
}

/** Totals over every table, for the message after a restore. */
export function restoreTotals(result: RestoreResult): RestoreTotals {
  let restored = 0;
  let removed = 0;
  let skipped = 0;
  for (const table of BACKUP_DATA_TABLES) {
    restored += result[table].restored;
    removed += result[table].removed;
    skipped += result[table].skipped;
  }
  return { restored, removed, skipped };
}
