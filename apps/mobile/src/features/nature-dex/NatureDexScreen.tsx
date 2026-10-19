import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { listNatures, type NatureEntry } from '@thedex/db';
import { RADII, SPACING, withAlpha } from '@thedex/ui-tokens';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { Card, Loading, Message, ThemedText } from '../../shared/ui/primitives';
import { TabBar } from '../../shared/ui/TabBar';
import { natureMatrix } from './nature-logic';

const TABS = ['matrix', 'list'] as const;
type NatureTab = (typeof TABS)[number];
/** Row header width; the five columns share the rest of the screen. */
const ROW_HEADER = 76;
const MIN_CELL = 58;

/** RF07.2: the 25 natures as a matrix and a list, with stat changes and flavors. */
export function NatureDexScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const natures = useAsync(() => listNatures(db, ctx), [db, ctx]);
  const [tab, setTab] = useState<NatureTab>('matrix');
  // No type in focus: the app accent.
  const accent = useTypeAccent(null);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: t('nav.natures') }} />
      {ctx.generationId < 3 ? (
        <Message text={t('natureDex.none')} />
      ) : (
        <>
          <TabBar
            tabs={TABS.map((key) => ({ key, label: t(`natureDex.${key}`) }))}
            active={tab}
            onChange={setTab}
            accent={accent}
          />
          {!natures.data ? (
            <Loading />
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              {tab === 'matrix' ? (
                <NatureMatrixView natures={natures.data} />
              ) : (
                <NatureList natures={natures.data} />
              )}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

function NatureMatrixView({ natures }: { natures: readonly NatureEntry[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const matrix = natureMatrix(natures);
  // Five columns share the screen beside the row headers, never narrower than MIN_CELL.
  const { width } = useWindowDimensions();
  const cell = { width: Math.max(MIN_CELL, (width - 2 * SPACING.lg - ROW_HEADER) / 5) };
  return (
    <View style={styles.gap}>
      <ThemedText variant="caption" muted>
        {t('natureDex.matrixNote')}
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.matrixRow}>
            <View style={styles.cornerCell} />
            {matrix.stats.map((stat) => (
              <View key={stat.id} style={[styles.headerCell, cell]}>
                <ThemedText
                  variant="caption"
                  bold
                  color={theme.colors.danger}
                  style={styles.center}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {`−${stat.name}`}
                </ThemedText>
              </View>
            ))}
          </View>
          {matrix.cells.map((cells, row) => (
            <View key={row} style={styles.matrixRow}>
              <View style={styles.cornerCell}>
                <ThemedText variant="caption" bold color={theme.colors.success}>
                  {matrix.stats[row] ? `+${matrix.stats[row]!.name}` : ''}
                </ThemedText>
              </View>
              {cells.map((nature, column) => (
                <View
                  key={column}
                  style={[
                    styles.cell,
                    cell,
                    {
                      backgroundColor:
                        row === column ? theme.colors.surfaceVariant : theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <ThemedText
                    variant="caption"
                    bold={row !== column}
                    muted={row === column}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {nature?.name ?? ''}
                  </ThemedText>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function NatureList({ natures }: { natures: readonly NatureEntry[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.gap}>
      <ThemedText variant="caption" muted>
        {t('natureDex.flavorNote')}
      </ThemedText>
      {[...natures]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((nature) => (
          <Card key={nature.id} style={styles.natureCard}>
            <ThemedText bold style={styles.natureName}>
              {nature.name}
            </ThemedText>
            {nature.increased && nature.decreased ? (
              <View style={styles.natureBody}>
                <View style={styles.pills}>
                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: withAlpha(theme.colors.success, 0.15) },
                    ]}
                  >
                    <ThemedText variant="caption" bold color={theme.colors.success}>
                      {`+ ${nature.increased.name}`}
                    </ThemedText>
                  </View>
                  <View
                    style={[styles.pill, { backgroundColor: withAlpha(theme.colors.danger, 0.15) }]}
                  >
                    <ThemedText variant="caption" bold color={theme.colors.danger}>
                      {`− ${nature.decreased.name}`}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText variant="caption" muted>
                  {`${t('natureDex.likes')}: ${nature.likes?.name ?? '—'} · ${t('natureDex.hates')}: ${nature.hates?.name ?? '—'}`}
                </ThemedText>
              </View>
            ) : (
              <ThemedText variant="caption" muted>
                {t('natureDex.neutral')}
              </ThemedText>
            )}
          </Card>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  gap: { gap: SPACING.sm },
  matrixRow: { flexDirection: 'row' },
  cornerCell: {
    width: ROW_HEADER,
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: SPACING.xs,
  },
  headerCell: { paddingVertical: SPACING.xs, alignItems: 'center', justifyContent: 'flex-end' },
  center: { textAlign: 'center' },
  cell: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
  },
  natureCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md },
  natureName: { width: 110 },
  natureBody: { flex: 1, gap: SPACING.xs },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  pill: { borderRadius: RADII.pill, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
});
