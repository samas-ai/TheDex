import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PokemonProfile } from '@thedex/db';
import { RADII, SPACING, statBarColor, type TypeAccent } from '@thedex/ui-tokens';
import { useCatalog } from '../../../entities/catalog/CatalogProvider';
import { useGame } from '../../../shared/game/GameProvider';
import { useTheme } from '../../../shared/theme/ThemeProvider';
import { Card, Section, ThemedText } from '../../../shared/ui/primitives';
import { statRows } from '../profile-logic';

/** Bars are scaled against the highest base stat in the games (Blissey's 255 HP). */
const MAX_BASE = 255;

/** RF02.4: animated base-stat bars, total, and Lv. 50 / Lv. 100 ranges from the engine. */
export function StatsTab({ profile, accent }: { profile: PokemonProfile; accent: TypeAccent }) {
  const { t } = useTranslation();
  const { ctx } = useGame();
  const { statName } = useCatalog();
  if (!profile.stats) {
    return <ThemedText muted>{t('profile.stats.noStats')}</ThemedText>;
  }
  const rows = statRows(profile.stats, ctx.generationId);
  return (
    <View>
      <Section title={t('profile.stats.base')}>
        <Card>
          <View style={styles.headerRow}>
            <View style={styles.label} />
            <View style={styles.flex} />
            <ThemedText variant="caption" muted style={styles.range}>
              {t('profile.stats.level', { level: 50 })}
            </ThemedText>
            <ThemedText variant="caption" muted style={styles.range}>
              {t('profile.stats.level', { level: 100 })}
            </ThemedText>
          </View>
          {rows.map((row) => (
            <View key={row.stat} style={styles.row}>
              <ThemedText variant="small" muted style={styles.label} numberOfLines={1}>
                {statName(row.stat)}
              </ThemedText>
              <ThemedText bold style={styles.value}>
                {row.base}
              </ThemedText>
              <StatBar value={row.base} />
              <ThemedText variant="small" style={styles.range}>
                {row.lv50.min}–{row.lv50.max}
              </ThemedText>
              <ThemedText variant="small" style={styles.range}>
                {row.lv100.min}–{row.lv100.max}
              </ThemedText>
            </View>
          ))}
          <View style={styles.row}>
            <ThemedText variant="small" bold style={styles.label}>
              {t('profile.stats.total')}
            </ThemedText>
            <ThemedText bold color={accent.text} style={styles.value}>
              {profile.stats.bst}
            </ThemedText>
          </View>
        </Card>
      </Section>
      <ThemedText variant="caption" muted>
        {t(ctx.generationId <= 2 ? 'profile.stats.noteGen1' : 'profile.stats.noteGen3')}
      </ThemedText>
    </View>
  );
}

function StatBar({ value }: { value: number }) {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: Math.min(1, value / MAX_BASE),
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [progress, value]);
  return (
    <View style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Animated.View
        style={[
          styles.bar,
          {
            backgroundColor: statBarColor(value),
            width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minHeight: 28 },
  label: { width: 72 },
  value: { width: 32, textAlign: 'right' },
  range: { width: 64, textAlign: 'right' },
  track: { flex: 1, height: 8, borderRadius: RADII.pill, overflow: 'hidden' },
  bar: { height: 8, borderRadius: RADII.pill },
});
