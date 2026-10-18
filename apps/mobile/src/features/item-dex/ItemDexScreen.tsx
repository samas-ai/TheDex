import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ITEM_GROUPS, listItems, type ItemGroup, type ItemListEntry } from '@thedex/db';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { ItemIcon } from '../../entities/item/ItemIcon';
import { TypeBadge } from '../../entities/pokemon/TypeBadge';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { formatPrice } from '../../shared/format';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useEntitySearch } from '../../shared/hooks/useEntitySearch';
import { applySearch } from '../../shared/search-filter';
import { toSectionRows } from '../../shared/sections';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { ListToolbar } from '../../shared/ui/ListToolbar';
import { Button, Chip, Loading, Message, ThemedText } from '../../shared/ui/primitives';

/** RF05.1: items by category (battle, berries, TMs, medicine, balls, evolution…). */
export function ItemDexScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const [group, setGroup] = useState<ItemGroup | null>(null);
  const [inGameOnly, setInGameOnly] = useState(true);
  const [query, setQuery] = useState('');
  const list = useAsync(
    () => listItems(db, ctx, { groups: group ? [group] : [], inGameOnly }),
    [db, ctx, group, inGameOnly],
  );
  const hits = useEntitySearch('item', query);
  const items = useMemo(() => applySearch(list.data ?? [], hits), [list.data, hits]);
  // "All": one section per group; a single group needs no headers.
  const rows = useMemo(
    () =>
      group === null
        ? toSectionRows(
            items,
            ITEM_GROUPS,
            (item) => item.group,
            (item) => String(item.id),
          )
        : items.map((item) => ({ type: 'item' as const, key: String(item.id), item })),
    [items, group],
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder={t('itemDex.searchPlaceholder')}
        count={t('itemDex.count', { count: items.length })}
      >
        <Chip
          label={t('common.inThisGame')}
          selected={inGameOnly}
          onPress={() => setInGameOnly((value) => !value)}
        />
      </ListToolbar>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groups}
        >
          <Chip label={t('itemDex.all')} selected={group === null} onPress={() => setGroup(null)} />
          {ITEM_GROUPS.map((key) => (
            <Chip
              key={key}
              label={t(`itemDex.groups.${key}`)}
              selected={group === key}
              onPress={() => setGroup(group === key ? null : key)}
            />
          ))}
        </ScrollView>
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
          data={rows}
          keyExtractor={(row) => row.key}
          getItemType={(row) => row.type}
          renderItem={({ item: row }) =>
            row.type === 'header' ? (
              <ThemedText variant="caption" bold muted style={styles.sectionHeader}>
                {t(`itemDex.groups.${row.header}`)}
              </ThemedText>
            ) : (
              <ItemRow item={row.item} />
            )
          }
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Message text={t('itemDex.empty')} />}
        />
      )}
    </View>
  );
}

const ItemRow = memo(function ItemRow({ item }: { item: ItemListEntry }) {
  const { i18n } = useTranslation();
  const theme = useTheme();
  const { typeName } = useCatalog();
  const accent = useTypeAccent(item.machineMove?.type);
  return (
    <Pressable
      onPress={() => router.push(`/item/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={item.machineMove ? `${item.name}, ${item.machineMove.name}` : item.name}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.surface,
          borderLeftColor: item.machineMove ? accent.base : 'transparent',
        },
      ]}
    >
      <ItemIcon itemId={item.id} size={32} />
      <View style={styles.body}>
        <ThemedText bold numberOfLines={1}>
          {item.name}
        </ThemedText>
        {item.machineMove ? (
          <View style={styles.machine}>
            {item.machineMove.type ? (
              <TypeBadge
                type={item.machineMove.type}
                name={typeName(item.machineMove.type)}
                size="sm"
              />
            ) : null}
            <ThemedText variant="small" numberOfLines={1} style={styles.flexShrink}>
              {item.machineMove.name}
            </ThemedText>
          </View>
        ) : null}
      </View>
      {item.cost ? (
        <ThemedText variant="small" muted>
          {formatPrice(item.cost, i18n.language)}
        </ThemedText>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  groups: { paddingHorizontal: SPACING.lg },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xxl,
  },
  sectionHeader: { marginTop: SPACING.sm, marginBottom: SPACING.xs, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADII.md,
    borderLeftWidth: 4,
  },
  body: { flex: 1, gap: 2 },
  machine: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  flexShrink: { flexShrink: 1 },
});
