import { StyleSheet, Text, View } from 'react-native';
import { DAMAGE_CLASS_COLORS, FONT_WEIGHTS, onColor, RADII, SPACING } from '@thedex/ui-tokens';
import { useCatalog } from '../catalog/CatalogProvider';

const isDamageClass = (value: string): value is keyof typeof DAMAGE_CLASS_COLORS =>
  Object.hasOwn(DAMAGE_CLASS_COLORS, value);

/** Move category pill (physical / special / status) with the game-data name. */
export function DamageClassBadge({
  damageClass,
  size = 'md',
}: {
  damageClass: string;
  size?: 'sm' | 'md';
}) {
  const { damageClassName } = useCatalog();
  if (!isDamageClass(damageClass)) return null;
  const color = DAMAGE_CLASS_COLORS[damageClass];
  const name = damageClassName(damageClass);
  return (
    <View
      style={[styles.badge, size === 'sm' && styles.small, { backgroundColor: color }]}
      accessibilityLabel={name}
    >
      <Text style={[styles.text, size === 'sm' && styles.smallText, { color: onColor(color) }]}>
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
    alignItems: 'center',
  },
  small: { paddingHorizontal: SPACING.sm, paddingVertical: 1 },
  text: { fontSize: 12, fontWeight: FONT_WEIGHTS.bold, textTransform: 'uppercase' },
  smallText: { fontSize: 10 },
});
