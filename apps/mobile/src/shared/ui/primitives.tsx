import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { FONT_SIZES, FONT_WEIGHTS, RADII, SPACING } from '@thedex/ui-tokens';
import { useTheme } from '../theme/ThemeProvider';

type Variant = keyof typeof FONT_SIZES;

interface ThemedTextProps extends TextProps {
  readonly variant?: Variant;
  readonly muted?: boolean;
  readonly bold?: boolean;
  /** Overrides the theme text color (accent text, text on a type badge…). */
  readonly color?: string;
  readonly style?: StyleProp<TextStyle>;
}

/** Text in the theme's colors and type scale. */
export function ThemedText({
  variant = 'body',
  muted,
  bold,
  color,
  style,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();
  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: FONT_SIZES[variant],
          color: color ?? (muted ? theme.colors.textMuted : theme.colors.text),
          fontWeight:
            bold || variant === 'headline' || variant === 'display'
              ? FONT_WEIGHTS.bold
              : FONT_WEIGHTS.regular,
        },
        style,
      ]}
    />
  );
}

interface ChipProps {
  readonly label: string;
  readonly selected?: boolean;
  readonly onPress?: () => void;
  /** Background when selected (defaults to the theme primary). */
  readonly selectedColor?: string;
  readonly selectedTextColor?: string;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
}

export function Chip({
  label,
  selected,
  onPress,
  selectedColor,
  selectedTextColor,
  disabled,
  accessibilityLabel,
}: ChipProps) {
  const theme = useTheme();
  const background = selected
    ? (selectedColor ?? theme.colors.primary)
    : theme.colors.surfaceVariant;
  const color = selected ? (selectedTextColor ?? theme.colors.onPrimary) : theme.colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: background, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Rounded surface block. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }, style]}>{children}</View>
  );
}

/** Titled group inside a screen. */
export function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText variant="title" bold>
          {title}
        </ThemedText>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Label / value line of an info card. */
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText muted style={styles.infoLabel}>
        {label}
      </ThemedText>
      {typeof value === 'string' || typeof value === 'number' ? (
        <ThemedText style={styles.infoValue}>{value}</ThemedText>
      ) : (
        <View style={styles.infoValueBox}>{value}</View>
      )}
    </View>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}

export function Message({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <View style={styles.center}>
      <ThemedText muted style={styles.message}>
        {text}
      </ThemedText>
      {action}
    </View>
  );
}

export function Button({
  label,
  onPress,
  color,
  textColor,
  disabled,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: color ?? theme.colors.primary,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[styles.buttonText, { color: textColor ?? theme.colors.onPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADII.pill,
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  chipText: { fontSize: FONT_SIZES.small, fontWeight: FONT_WEIGHTS.medium },
  card: { borderRadius: RADII.lg, padding: SPACING.lg, gap: SPACING.sm },
  section: { gap: SPACING.sm, marginBottom: SPACING.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 28 },
  infoLabel: { flex: 2 },
  infoValue: { flex: 3, textAlign: 'right' },
  infoValueBox: { flex: 3, alignItems: 'flex-end' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  message: { textAlign: 'center' },
  button: {
    borderRadius: RADII.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  buttonText: { fontSize: FONT_SIZES.body, fontWeight: FONT_WEIGHTS.bold },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
});
