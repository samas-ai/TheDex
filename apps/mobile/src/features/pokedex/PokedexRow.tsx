import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { PokedexEntry, PokedexSortKey } from '@thedex/db';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { PokemonSprite } from '../../entities/pokemon/PokemonSprite';
import { TypeBadge } from '../../entities/pokemon/TypeBadge';
import { dexNumber } from '../../shared/format';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { ThemedText } from '../../shared/ui/primitives';
import { sortValue } from './pokedex-state';

/**
 * List rows use the compact pixel sprites (~600 B each) whatever the global style, so
 * scrolling a 1 000-row Pokédex never pulls hundreds of MB of artwork.
 */
export const LIST_SPRITE_STYLE = 'pixel';

interface Props {
  readonly entry: PokedexEntry;
  readonly sortKey: PokedexSortKey;
  readonly onPress: (entry: PokedexEntry) => void;
}

export const PokedexRow = memo(function PokedexRow({ entry, sortKey, onPress }: Props) {
  const theme = useTheme();
  const { typeName } = useCatalog();
  const accent = useTypeAccent(entry.types[0]);
  const number =
    sortKey !== 'national' && entry.regionalNumber !== null
      ? entry.regionalNumber
      : entry.nationalNumber;
  const value = sortValue(entry, sortKey);
  return (
    <Pressable
      onPress={() => onPress(entry)}
      accessibilityRole="button"
      accessibilityLabel={`${entry.name} ${dexNumber(number)}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? accent.tint : theme.colors.surface,
          borderLeftColor: accent.base,
        },
      ]}
    >
      <PokemonSprite pokemonId={entry.id} style={LIST_SPRITE_STYLE} size={56} />
      <View style={styles.body}>
        <ThemedText variant="caption" muted>
          {dexNumber(number)}
        </ThemedText>
        <ThemedText bold numberOfLines={1}>
          {entry.name}
        </ThemedText>
        <View style={styles.types}>
          {entry.types.map((type) => (
            <TypeBadge key={type} type={type} name={typeName(type)} size="sm" />
          ))}
        </View>
      </View>
      {value !== null ? (
        <ThemedText variant="title" bold color={accent.text}>
          {value}
        </ThemedText>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADII.md,
    borderLeftWidth: 4,
  },
  body: { flex: 1, gap: 2 },
  types: { flexDirection: 'row', gap: SPACING.xs, marginTop: 2 },
});
