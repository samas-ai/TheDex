import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  BackupError,
  exportBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  summarizeBackup,
  type Backup,
  type RestoreMode,
} from '@thedex/db';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { notifyUserDataReplaced } from '../../shared/db/user-data-events';
import { formatDateTime } from '../../shared/format';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Button, Card, Section, ThemedText } from '../../shared/ui/primitives';
import { backupFileName, restoreTotals } from './backup-logic';

/**
 * RNF06: manual backup. Exports teams, favorites, checklist and settings as a `.thedex` file
 * through the share sheet (Drive, Files, e-mail…) and restores one picked from the device —
 * merging (newest wins) or replacing the current data.
 */
export function BackupSection() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const fail = (e: unknown) => {
    const message =
      e instanceof BackupError
        ? t(`backup.errors.${e.code}`)
        : t('common.error', { message: e instanceof Error ? e.message : String(e) });
    Alert.alert(t('backup.failed'), message);
  };

  const exportFile = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const now = Date.now();
      const backup = await exportBackup(db, now);
      const file = new File(Paths.cache, backupFileName(new Date(now)));
      if (file.exists) file.delete();
      file.create();
      await file.write(serializeBackup(backup));
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t('share.unavailable'));
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        UTI: 'public.json',
        dialogTitle: t('backup.export'),
      });
      const summary = summarizeBackup(backup);
      setStatus(
        t('backup.exported', { teams: summary.teams, checklist: summary.checklistEntries }),
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (backup: Backup, mode: RestoreMode) => {
    setBusy(true);
    try {
      const result = await restoreBackup(db, backup, mode, Date.now());
      notifyUserDataReplaced();
      const totals = restoreTotals(result);
      setStatus(
        [
          t('backup.restored', {
            teams: result.teams.restored,
            checklist: result.checklistEntries.restored,
            settings: result.settings.restored,
          }),
          totals.removed > 0 ? t('backup.removed', { count: totals.removed }) : null,
          totals.skipped > 0 ? t('backup.skipped', { count: totals.skipped }) : null,
        ]
          .filter(Boolean)
          .join('\n'),
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const confirmReplace = (backup: Backup) =>
    Alert.alert(t('backup.replaceTitle'), t('backup.replaceWarning'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backup.replace'),
        style: 'destructive',
        onPress: () => void restore(backup, 'replace'),
      },
    ]);

  const importFile = async () => {
    setStatus(null);
    let backup: Backup;
    try {
      // `.thedex` has no registered MIME type: any file can be picked, the parser checks it.
      const picked = await File.pickFileAsync();
      if (picked.canceled) return;
      backup = parseBackup(await picked.result.text());
    } catch (e) {
      fail(e);
      return;
    }
    const summary = summarizeBackup(backup);
    Alert.alert(
      t('backup.importTitle'),
      t('backup.contents', {
        date: formatDateTime(summary.exportedAt, i18n.language),
        teams: summary.teams,
        checklist: summary.checklistEntries,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('backup.replace'), style: 'destructive', onPress: () => confirmReplace(backup) },
        { text: t('backup.merge'), onPress: () => void restore(backup, 'merge') },
      ],
    );
  };

  return (
    <Section title={t('backup.title')}>
      <Card>
        <ThemedText variant="small" muted>
          {t('backup.hint')}
        </ThemedText>
        <Button label={t('backup.export')} onPress={() => void exportFile()} disabled={busy} />
        <Button
          label={t('backup.import')}
          onPress={() => void importFile()}
          disabled={busy}
          color={theme.colors.surfaceVariant}
          textColor={theme.colors.text}
        />
        <ThemedText variant="caption" muted>
          {t('backup.modes')}
        </ThemedText>
        {status ? <ThemedText variant="small">{status}</ThemedText> : null}
      </Card>
    </Section>
  );
}
