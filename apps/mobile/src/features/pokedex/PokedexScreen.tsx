import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { listPokedex, searchQuery, type PokedexEntry } from '@thedex/db';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Button, Chip, Loading, Message, ThemedText } from '../../shared/ui/primitives';
import { FilterSheet } from './FilterSheet';
import { PokedexRow } from './PokedexRow';
import {
  activeFilterCount,
  applySearch,
  DEFAULT_SORT,
  EMPTY_FILTERS,
  toRepoFilters,
  type PokedexFilterState,
  type PokedexSort,
} from './pokedex-state';
import { SortSheet } from './SortSheet';

/** Every alternate form can match; the list itself caps the result anyway. */
const SEARCH_LIMIT = 2000;

/** RF01: the game's Pokédex with search, filters and sorting. */
export function PokedexScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx, game } = useGame();
  const [filters, setFilters] = useState<PokedexFilterState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<PokedexSort>(DEFAULT_SORT);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<'filters' | 'sort' | null>(null);

  const list = useAsync(
    () => listPokedex(db, ctx, { filters: toRepoFilters(filters), sort }),
    [db, ctx, filters, sort],
  );
  const search = useAsync(async () => {
    if (query.trim() === '') return null;
    const result = await searchQuery(db, query, ctx, {
      entityTypes: ['pokemon'],
      limitPerType: SEARCH_LIMIT,
    });
    return new Set(result.hits.map((hit) => hit.entityId));
  }, [db, ctx, query]);

  const entries = useMemo(
    () => applySearch(list.data ?? [], query.trim() === '' ? null : (search.data ?? null)),
    [list.data, search.data, query],
  );
  const openPokemon = useCallback((entry: PokedexEntry) => {
    router.push(`/pokemon/${entry.id}`);
  }, []);

  const filterCount = activeFilterCount(filters);
  const headerRight = useCallback(
    () => (
      <View style={styles.headerActions}>
        <Chip label={game.name} onPress={() => router.push('/game')} />
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel={t('nav.settings')}
          hitSlop={8}
        >
          <ThemedText variant="headline">⚙</ThemedText>
        </Pressable>
      </View>
    ),
    [game.name, t],
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: t('nav.pokedex'), headerRight }} />
      <View style={styles.toolbar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('pokedex.searchPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          style={[
            styles.search,
            { backgroundColor: theme.colors.surface, color: theme.colors.text },
          ]}
        />
        <View style={styles.chips}>
          <Chip
            label={
              filterCount > 0
                ? t('pokedex.filtersActive', { count: filterCount })
                : t('pokedex.filters')
            }
            selected={filterCount > 0}
            onPress={() => setSheet('filters')}
          />
          <Chip
            label={`${t(`pokedex.sortKeys.${sort.key}`)} ${sort.direction === 'asc' ? '↑' : '↓'}`}
            onPress={() => setSheet('sort')}
          />
          <ThemedText variant="caption" muted style={styles.count}>
            {t('pokedex.count', { count: entries.length })}
          </ThemedText>
        </View>
      </View>

      {list.error ? (
        <Message
          text={t('common.error', { message: list.error.message })}
          action={<Button label={t('common.retry')} onPress={list.reload} />}
        />
      ) : !list.data ? (
        <Loading />
      ) : (
        <FlashList
          data={entries}
          keyExtractor={(entry) => String(entry.id)}
          renderItem={({ item }) => (
            <PokedexRow entry={item} sortKey={sort.key} onPress={openPokemon} />
          )}
          extraData={sort.key}
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Message
              text={t('pokedex.empty')}
              action={
                filterCount > 0 ? (
                  <Button
                    label={t('pokedex.clearFilters')}
                    onPress={() => setFilters(EMPTY_FILTERS)}
                  />
                ) : undefined
              }
            />
          }
        />
      )}

      <FilterSheet
        visible={sheet === 'filters'}
        filters={filters}
        onChange={setFilters}
        onClose={() => setSheet(null)}
      />
      <SortSheet
        visible={sheet === 'sort'}
        sort={sort}
        onChange={(next) => {
          setSort(next);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.sm },
  search: {
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  count: { marginLeft: 'auto', marginBottom: SPACING.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  listContent: { paddingTop: SPACING.xs, paddingBottom: SPACING.xxl },
});
