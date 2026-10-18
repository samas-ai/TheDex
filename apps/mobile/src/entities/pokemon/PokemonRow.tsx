import { router } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { dexNumber } from '../../shared/format';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { ThemedText } from '../../shared/ui/primitives';
import { useCatalog } from '../catalog/CatalogProvider';
import { PokemonSprite } from './PokemonSprite';
import { TypeBadge } from './TypeBadge';

/** Sprites of compact rows (move learners, ability holders, encounters…), like the Pokédex. */
const ROW_SPRITE_STYLE = 'pixel';

/**
 * A Pokémon in a secondary list, opening its profile. `dimmed` marks varieties that are not in
 * the selected game; `detail` and `right` add per-list information (levels, rates…).
 */
export const PokemonRow = memo(function PokemonRow({
  pokemonId,
  speciesId,
  name,
  types,
  detail,
  right,
  dimmed,
}: {
  pokemonId: number;
  speciesId: number;
  name: string;
  types: readonly string[];
  detail?: ReactNode;
  right?: ReactNode;
  dimmed?: boolean;
}) {
  const theme = useTheme();
  const { typeName } = useCatalog();
  const accent = useTypeAccent(types[0]);
  return (
    <Pressable
      onPress={() => router.push(`/pokemon/${pokemonId}`)}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? accent.tint : theme.colors.surface,
          borderLeftColor: accent.base,
          opacity: dimmed ? 0.6 : 1,
        },
      ]}
    >
      <PokemonSprite pokemonId={pokemonId} style={ROW_SPRITE_STYLE} size={44} />
      <View style={styles.body}>
        <View style={styles.title}>
          <ThemedText bold numberOfLines={1} style={styles.name}>
            {name}
          </ThemedText>
          <ThemedText variant="caption" muted>
            {dexNumber(speciesId)}
          </ThemedText>
        </View>
        <View style={styles.types}>
          {types.map((type) => (
            <TypeBadge key={type} type={type} name={typeName(type)} size="sm" />
          ))}
        </View>
        {detail}
      </View>
      {right}
    </Pressable>
  );
});

const styles = StyleSheet.create({
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
