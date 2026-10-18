import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { listMoves, MOVE_SORT_KEYS } from '@thedex/db';
import { SPACING } from '@thedex/ui-tokens';
import { MoveRow } from '../../entities/move/MoveRow';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useEntitySearch } from '../../shared/hooks/useEntitySearch';
import { applySearch } from '../../shared/search-filter';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { ListToolbar } from '../../shared/ui/ListToolbar';
import { Button, Chip, Loading, Message, ThemedText } from '../../shared/ui/primitives';
import { SortSheet } from '../../shared/ui/SortSheet';
import {
  activeMoveFilterCount,
  DEFAULT_MOVE_SORT,
  defaultMoveFilters,
  moveSortValue,
  nextMoveSort,
  toRepoMoveFilters,
  type MoveFilterState,
  type MoveSort,
} from './move-dex-state';
import { MoveFilterSheet } from './MoveFilterSheet';

/** RF03.1: the selected game's moves with search, filters and sorting. */
export function MoveDexScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx, features } = useGame();
  const [filters, setFilters] = useState<MoveFilterState>(() =>
    defaultMoveFilters(features.hasLearnsets),
  );
  const [sort, setSort] = useState<MoveSort>(DEFAULT_MOVE_SORT);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<'filters' | 'sort' | null>(null);

  // Games without learnsets in PokeAPI cannot filter by learnability.
  useEffect(() => {
    setFilters((current) => ({ ...current, learnableOnly: features.hasLearnsets }));
  }, [features.hasLearnsets]);

  const list = useAsync(
    () => listMoves(db, ctx, { filters: toRepoMoveFilters(filters), sort }),
    [db, ctx, filters, sort],
  );
  const hits = useEntitySearch('move', query);
  const moves = useMemo(() => applySearch(list.data ?? [], hits), [list.data, hits]);
  const openMove = useCallback((moveId: number) => router.push(`/move/${moveId}`), []);
  const filterCount = activeMoveFilterCount(filters, features.hasLearnsets);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder={t('moveDex.searchPlaceholder')}
        count={t('moveDex.count', { count: moves.length })}
      >
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
          label={`${t(`moveDex.sortKeys.${sort.key}`)} ${sort.direction === 'asc' ? '↑' : '↓'}`}
          onPress={() => setSheet('sort')}
        />
      </ListToolbar>
      {!features.hasLearnsets ? (
        <ThemedText variant="caption" muted style={styles.note}>
          {t('moveDex.noLearnsets')}
        </ThemedText>
      ) : null}

      {list.error ? (
        <Message
          text={t('common.error', { message: list.error.message })}
          action={<Button label={t('common.retry')} onPress={list.reload} />}
        />
      ) : !list.data ? (
        <Loading />
      ) : (
        <FlashList
          data={moves}
          keyExtractor={(move) => String(move.id)}
          renderItem={({ item }) => {
            const value = moveSortValue(item, sort.key);
            return (
              <MoveRow
                move={item}
                onPress={openMove}
                right={
                  value !== null ? (
                    <ThemedText bold variant="title">
                      {value}
                    </ThemedText>
                  ) : item.variantKind === 'z' || item.variantKind === 'max' ? (
                    <ThemedText variant="caption" muted>
                      {t(`moveDex.variants.${item.variantKind}`)}
                    </ThemedText>
                  ) : null
                }
              />
            );
          }}
          extraData={sort.key}
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Message text={t('moveDex.empty')} />}
        />
      )}

      <MoveFilterSheet
        visible={sheet === 'filters'}
        filters={filters}
        onChange={setFilters}
        onClose={() => setSheet(null)}
      />
      <SortSheet
        visible={sheet === 'sort'}
        keys={MOVE_SORT_KEYS}
        labelOf={(key) => t(`moveDex.sortKeys.${key}`)}
        sort={sort}
        onSelect={(key) => {
          setSort(nextMoveSort(sort, key));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  note: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xxl,
  },
});
