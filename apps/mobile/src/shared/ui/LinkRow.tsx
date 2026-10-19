import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SPACING } from '@thedex/ui-tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { ThemedText } from './primitives';

/** A tappable line inside a card that opens another entry (move, item, location…). */
export function LinkRow({
  title,
  subtitle,
  leading,
  onPress,
  color,
}: {
  title: string;
  subtitle?: string | null;
  leading?: ReactNode;
  onPress: () => void;
  /** Title color (the screen's accent text). */
  color?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      {leading}
      <View style={styles.body}>
        <ThemedText bold color={color}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText variant="caption" muted>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <Icon name="chevron-right" size={20} color={theme.colors.textMuted} />
    </Pressable>
  );
}

/** Label / big value tiles (power, accuracy, PP…). */
export function StatTiles({
  items,
  color,
}: {
  items: readonly { readonly label: string; readonly value: string; readonly detail?: string }[];
  color?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.tiles}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[styles.tile, { backgroundColor: theme.colors.surface }]}
          accessible
          accessibilityLabel={`${item.label}: ${item.value}${item.detail ? ` (${item.detail})` : ''}`}
        >
          <ThemedText variant="caption" muted>
            {item.label}
          </ThemedText>
          <ThemedText variant="title" bold color={color} style={styles.center}>
            {item.value}
          </ThemedText>
          {item.detail ? (
            <ThemedText variant="caption" muted style={styles.center}>
              {item.detail}
            </ThemedText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 40 },
  body: { flex: 1, gap: 2 },
  tiles: { flexDirection: 'row', gap: SPACING.sm },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    gap: 2,
  },
  center: { textAlign: 'center' },
});
