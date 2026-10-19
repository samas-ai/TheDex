import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { listPokedex, searchQuery, type GameContext, type PokedexEntry } from '@thedex/db';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { dexNumber } from '../../shared/format';
import { useAsync } from '../../shared/hooks/useAsync';
import { applySearch } from '../../shared/search-filter';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { FullScreenModal } from '../../shared/ui/FullScreenModal';
import { Loading, Message, ThemedText } from '../../shared/ui/primitives';
import { SearchField } from '../../shared/ui/SearchField';
import { useCatalog } from '../catalog/CatalogProvider';
import { PokemonSprite } from './PokemonSprite';
import { TypeBadge } from './TypeBadge';

const SEARCH_LIMIT = 2000;

/**
 * Picks a Pokémon (variety) of a game: its Pokédex in regional order, with forms, and the same
 * multilingual search as the Pokédex (RNF07). Used by the team builder, comparator and
 * calculators.
 */
export function PokemonPicker({
  visible,
  title,
  ctx,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  /** Game whose Pokédex is listed (a team's game may differ from the selected one). */
  ctx: GameContext;
  onSelect: (entry: PokedexEntry) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { db } = useAppDatabase();
  const [query, setQuery] = useState('');
  const list = useAsync(async () => (visible ? listPokedex(db, ctx) : null), [db, ctx, visible]);
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
  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <FullScreenModal visible={visible} title={title} onClose={close}>
      <View style={styles.toolbar}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t('pokedex.searchPlaceholder')}
        />
      </View>
      {!list.data ? (
        <Loading />
      ) : (
        <FlashList
          data={entries}
          keyExtractor={(entry) => String(entry.id)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Message text={t('pokedex.empty')} />}
          renderItem={({ item }) => (
            <PickerRow
              entry={item}
              onPress={() => {
                setQuery('');
                onSelect(item);
              }}
            />
          )}
        />
      )}
    </FullScreenModal>
  );
}

function PickerRow({ entry, onPress }: { entry: PokedexEntry; onPress: () => void }) {
  const theme = useTheme();
  const { typeName } = useCatalog();
  const accent = useTypeAccent(entry.types[0]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={entry.name}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? accent.tint : theme.colors.surface,
          borderLeftColor: accent.base,
        },
      ]}
    >
      <PokemonSprite pokemonId={entry.id} style="pixel" size={44} />
      <View style={styles.body}>
        <View style={styles.title}>
          <ThemedText bold numberOfLines={1} style={styles.name}>
            {entry.name}
          </ThemedText>
          <ThemedText variant="caption" muted>
            {dexNumber(entry.regionalNumber ?? entry.nationalNumber)}
          </ThemedText>
        </View>
        <View style={styles.types}>
          {entry.types.map((type) => (
            <TypeBadge key={type} type={type} name={typeName(type)} size="sm" />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toolbar: { padding: SPACING.lg, paddingBottom: SPACING.sm },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: RADII.md,
    borderLeftWidth: 4,
  },
  body: { flex: 1, gap: 2 },
  title: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.sm },
  name: { flexShrink: 1 },
  types: { flexDirection: 'row', gap: SPACING.xs },
});
