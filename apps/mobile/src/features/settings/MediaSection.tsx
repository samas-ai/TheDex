import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CRY_STYLE, SPRITE_STYLES } from '@thedex/db';
import { SPACING } from '@thedex/ui-tokens';
import { useAsync } from '../../shared/hooks/useAsync';
import { formatBytes } from '../../shared/media/media-paths';
import { useMediaService } from '../../shared/media/MediaProvider';
import type { DownloadProgress } from '../../shared/media/media-service';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Button, Card, Section, ThemedText } from '../../shared/ui/primitives';

/** RNF02: cache size, "download all media packs for offline use", and clearing the cache. */
export function MediaSection() {
  const { t } = useTranslation();
  const theme = useTheme();
  const media = useMediaService();
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [result, setResult] = useState<DownloadProgress | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const signal = useRef<{ aborted: boolean }>({ aborted: false });
  const info = useAsync(
    async () => ({ stats: await media.stats(), packs: await media.packSizes() }),
    [media, running],
  );

  const packStyles = media.canPlayCries ? [...SPRITE_STYLES, CRY_STYLE] : [...SPRITE_STYLES];
  const labelOf = (style: string) =>
    style === CRY_STYLE
      ? t('settings.cries')
      : t(`settings.spriteStyles.${style as (typeof SPRITE_STYLES)[number]}`);

  const download = async (style: string) => {
    signal.current = { aborted: false };
    setRunning(style);
    setResult(null);
    const outcome = await media.downloadAll([style], setProgress, signal.current);
    setProgress(null);
    setResult(outcome);
    setRunning(null);
  };

  return (
    <Section title={t('settings.media')}>
      <Card>
        <ThemedText variant="small" muted>
          {t('settings.mediaHint')}
        </ThemedText>
        {info.data ? (
          <ThemedText>
            {t('settings.cached', {
              files: info.data.stats.files,
              size: formatBytes(info.data.stats.bytes),
            })}
          </ThemedText>
        ) : null}
        {running && progress ? (
          <View style={layout.row}>
            <ThemedText style={layout.flex}>
              {t('settings.downloading', { done: progress.done, total: progress.total })}
            </ThemedText>
            <Button
              label={t('settings.cancelDownload')}
              onPress={() => {
                signal.current.aborted = true;
              }}
              color={theme.colors.surfaceVariant}
              textColor={theme.colors.text}
            />
          </View>
        ) : null}
        {result ? (
          <ThemedText variant="small" muted>
            {t('settings.downloadDone', {
              downloaded: result.done - result.failed,
              failed: result.failed,
            })}
          </ThemedText>
        ) : null}
        {packStyles.map((style) => {
          const pack = info.data?.packs.find((p) => p.style === style);
          return (
            <Button
              key={style}
              label={t('settings.downloadPack', {
                name: labelOf(style),
                size: formatBytes(pack?.bytes ?? 0),
              })}
              onPress={() => void download(style)}
              disabled={running !== null}
              color={theme.colors.surfaceVariant}
              textColor={theme.colors.text}
            />
          );
        })}
        <Button
          label={t('settings.clearCache')}
          onPress={() => {
            void media.clear().then(info.reload);
          }}
          disabled={running !== null}
          color={theme.colors.danger}
          textColor={theme.colors.onPrimary}
        />
      </Card>
    </Section>
  );
}

const layout = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  flex: { flex: 1 },
});
