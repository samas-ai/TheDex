import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { checklistScope, listPokedex, searchQuery, type PokedexEntry } from '@thedex/db';
import { SPACING } from '@thedex/ui-tokens';
import { useFavoritesVersion } from '../../entities/favorite/favorites-store';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useUserDataVersion } from '../../shared/db/user-data-events';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useSettings } from '../../shared/settings/SettingsProvider';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Button, Chip, Loading, Message, ThemedText } from '../../shared/ui/primitives';
import { SearchField } from '../../shared/ui/SearchField';
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
  const { ctx } = useGame();
  const { settings } = useSettings();
  const captureScope = checklistScope(settings.checklistKind, ctx.gameId);
  // The capture filter reads the checklist, which a backup restore may replace.
  const userData = useUserDataVersion();
  const favoritesVersion = useFavoritesVersion();
  const [filters, setFilters] = useState<PokedexFilterState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<PokedexSort>(DEFAULT_SORT);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<'filters' | 'sort' | null>(null);

  const list = useAsync(
    () => listPokedex(db, ctx, { filters: toRepoFilters(filters, captureScope), sort }),
    // A star toggled in a profile only changes the list under the favorites filter.
    [db, ctx, filters, sort, captureScope, userData, filters.favorites ? favoritesVersion : 0],
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

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <View style={styles.toolbar}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t('pokedex.searchPlaceholder')}
        />
        <View style={styles.chips}>
          <Chip
            label={
              filterCount > 0
                ? t('common.filtersActive', { count: filterCount })
                : t('common.filters')
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
              text={
                filters.favorites && filterCount === 1
                  ? t('pokedex.noFavorites')
                  : t('pokedex.empty')
              }
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
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  count: { marginLeft: 'auto', marginBottom: SPACING.sm },
  listContent: { paddingTop: SPACING.xs, paddingBottom: SPACING.xxl },
});
