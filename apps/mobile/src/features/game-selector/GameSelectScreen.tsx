import { router, Stack } from 'expo-router';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { GameSummary } from '@thedex/db';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { useGame } from '../../shared/game/GameProvider';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { ThemedText } from '../../shared/ui/primitives';

/** RF01.2: global game selector, grouped by generation. */
export function GameSelectScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { games, game: current, selectGame } = useGame();
  const sections: { generation: number; data: GameSummary[] }[] = [];
  for (const game of games) {
    const last = sections[sections.length - 1];
    if (last && last.generation === game.generationId) last.data.push(game);
    else sections.push({ generation: game.generationId, data: [game] });
  }
  sections.reverse();

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: t('nav.selectGame'), presentation: 'modal' }} />
      <SectionList
        sections={sections}
        keyExtractor={(game) => String(game.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <ThemedText variant="small" muted style={styles.hint}>
            {t('game.hint')}
          </ThemedText>
        }
        renderSectionHeader={({ section }) => (
          <ThemedText variant="caption" bold muted style={styles.sectionHeader}>
            {t('game.generation', { number: section.generation })}
          </ThemedText>
        )}
        renderItem={({ item }) => {
          const selected = item.id === current.id;
          return (
            <Pressable
              onPress={() => {
                selectGame(item.id);
                router.back();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: selected
                    ? theme.colors.surfaceVariant
                    : pressed
                      ? theme.colors.surfaceVariant
                      : theme.colors.surface,
                  borderColor: selected ? theme.colors.primary : 'transparent',
                },
              ]}
            >
              <ThemedText bold={selected} style={styles.flex}>
                {item.name}
              </ThemedText>
              {selected ? <ThemedText color={theme.colors.primary}>✓</ThemedText> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  hint: { marginBottom: SPACING.md },
  sectionHeader: { marginTop: SPACING.md, marginBottom: SPACING.xs, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADII.md,
    borderWidth: 2,
    marginBottom: SPACING.xs,
  },
});
