import { StyleSheet, Text, View } from 'react-native';
import { FONT_WEIGHTS, RADII, SPACING } from '@thedex/ui-tokens';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';

/** Type pill in the type color. `name` is the localized type name from the game DB. */
export function TypeBadge({
  type,
  name,
  size = 'md',
}: {
  type: string;
  name: string;
  size?: 'sm' | 'md';
}) {
  const accent = useTypeAccent(type);
  return (
    <View
      style={[styles.badge, size === 'sm' && styles.small, { backgroundColor: accent.base }]}
      accessibilityLabel={name}
    >
      <Text
        style={[styles.text, size === 'sm' && styles.smallText, { color: accent.onBase }]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: RADII.pill,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
    minWidth: 64,
    alignItems: 'center',
  },
  small: { minWidth: 0, paddingHorizontal: SPACING.sm, paddingVertical: 1 },
  text: { fontSize: 12, fontWeight: FONT_WEIGHTS.bold, textTransform: 'uppercase' },
  smallText: { fontSize: 10 },
});
