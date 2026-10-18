import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { listAbilityDex, type AbilityListEntry } from '@thedex/db';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useEntitySearch } from '../../shared/hooks/useEntitySearch';
import { applySearch } from '../../shared/search-filter';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Icon } from '../../shared/ui/Icon';
import { ListToolbar } from '../../shared/ui/ListToolbar';
import { Button, Chip, Loading, Message, ThemedText } from '../../shared/ui/primitives';

/** RF04.1: abilities of the selected game's generation, with their battle effect. */
export function AbilityDexScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const [query, setQuery] = useState('');
  const [inGameOnly, setInGameOnly] = useState(true);
  const list = useAsync(() => listAbilityDex(db, ctx, { inGameOnly }), [db, ctx, inGameOnly]);
  const hits = useEntitySearch('ability', query);
  const abilities = useMemo(() => applySearch(list.data ?? [], hits), [list.data, hits]);

  if (ctx.generationId < 3) {
    return <Message text={t('abilityDex.none')} />;
  }
  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder={t('abilityDex.searchPlaceholder')}
        count={t('abilityDex.count', { count: abilities.length })}
      >
        <Chip
          label={t('common.inThisGame')}
          selected={inGameOnly}
          onPress={() => setInGameOnly((value) => !value)}
        />
      </ListToolbar>
      {list.error ? (
        <Message
          text={t('common.error', { message: list.error.message })}
          action={<Button label={t('common.retry')} onPress={list.reload} />}
        />
      ) : !list.data ? (
        <Loading />
      ) : (
        <FlashList
          data={abilities}
          keyExtractor={(ability) => String(ability.id)}
          renderItem={({ item }) => <AbilityRow ability={item} />}
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Message text={t('abilityDex.empty')} />}
        />
      )}
    </View>
  );
}

const AbilityRow = memo(function AbilityRow({ ability }: { ability: AbilityListEntry }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/ability/${ability.id}`)}
      accessibilityRole="button"
      accessibilityLabel={ability.name}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.surface },
      ]}
    >
      <View style={styles.body}>
        <View style={styles.title}>
          <ThemedText bold style={styles.name} numberOfLines={1}>
            {ability.name}
          </ThemedText>
          <ThemedText variant="caption" muted>
            {t('common.genShort', { number: ability.generationId })}
          </ThemedText>
        </View>
        {ability.shortEffect ? (
          <ThemedText variant="small" muted numberOfLines={2}>
            {ability.shortEffect}
          </ThemedText>
        ) : null}
      </View>
      <Icon name="chevron-right" size={20} color={theme.colors.textMuted} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADII.md,
  },
  body: { flex: 1, gap: 2 },
  title: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm },
  name: { flexShrink: 1 },
});
