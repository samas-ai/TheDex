import { StyleSheet, View } from 'react-native';
import { RADII } from '@thedex/ui-tokens';
import { useTheme } from '../theme/ThemeProvider';

/** Horizontal bar filled to `value` (0–1) in `color`. */
export function ProgressBar({
  value,
  color,
  height = 8,
}: {
  value: number;
  color?: string;
  height?: number;
}) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      style={[styles.track, { height, backgroundColor: theme.colors.surfaceVariant }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height,
          borderRadius: RADII.pill,
          backgroundColor: color ?? theme.colors.primary,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flex: 1, borderRadius: RADII.pill, overflow: 'hidden' },
});
