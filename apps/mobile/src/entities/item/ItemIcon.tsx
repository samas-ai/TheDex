import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { RADII } from '@thedex/ui-tokens';
import { useItemIconUri } from '../../shared/media/MediaProvider';
import { useTheme } from '../../shared/theme/ThemeProvider';

/**
 * Bag icon of an item (RF05.2) through MediaService: downloaded once from the pinned sprites
 * commit, then offline. A neutral tile stands in while loading or offline.
 */
export function ItemIcon({ itemId, size }: { itemId: number; size: number }) {
  const theme = useTheme();
  const uri = useItemIconUri(itemId);
  const box = { width: size, height: size };
  if (!uri) {
    return (
      <View style={[box, styles.placeholder, { backgroundColor: theme.colors.surfaceVariant }]} />
    );
  }
  return (
    <Image
      source={{ uri }}
      style={box}
      contentFit="contain"
      cachePolicy="memory"
      recyclingKey={String(itemId)}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  placeholder: { borderRadius: RADII.sm },
});
