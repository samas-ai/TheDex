import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { RADII } from '@thedex/ui-tokens';
import { useSpriteUri } from '../../shared/media/MediaProvider';
import { useTheme } from '../../shared/theme/ThemeProvider';

/**
 * Sprite through MediaService (downloaded once, then offline). Shows a neutral placeholder
 * while loading or when the file is not cached and there is no connection.
 */
export function PokemonSprite({
  pokemonId,
  style,
  shiny = false,
  size,
}: {
  pokemonId: number;
  style: string;
  shiny?: boolean;
  size: number;
}) {
  const theme = useTheme();
  const uri = useSpriteUri(pokemonId, style, shiny);
  const box = { width: size, height: size };
  if (!uri) {
    return (
      <View style={[box, styles.placeholder]}>
        <View
          style={[
            styles.dot,
            {
              width: size * 0.4,
              height: size * 0.4,
              borderRadius: size * 0.2,
              backgroundColor: theme.colors.surfaceVariant,
            },
          ]}
        />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={box}
      contentFit="contain"
      transition={120}
      cachePolicy="memory"
      recyclingKey={`${pokemonId}-${style}-${shiny ? 1 : 0}`}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: 'center', justifyContent: 'center', borderRadius: RADII.md },
  dot: {},
});
