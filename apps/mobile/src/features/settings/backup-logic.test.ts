import { describe, expect, it } from 'vitest';
import { backupFileName, restoreTotals } from './backup-logic';

describe('backup files', () => {
  it('names files by local date and time', () => {
    expect(backupFileName(new Date(2026, 9, 19, 8, 5))).toBe(
      'thedex-backup-2026-10-19-0805.thedex',
    );
    expect(backupFileName(new Date(2027, 0, 2, 23, 59))).toBe(
      'thedex-backup-2027-01-02-2359.thedex',
    );
  });

  it('adds up the restore counts of every table', () => {
    const none = { restored: 0, removed: 0, skipped: 0 };
    expect(
      restoreTotals({
        settings: { restored: 2, removed: 0, skipped: 1 },
        favorites: none,
        teams: { restored: 1, removed: 3, skipped: 0 },
        checklistEntries: { restored: 150, removed: 0, skipped: 4 },
      }),
    ).toEqual({ restored: 153, removed: 3, skipped: 5 });
  });
});
