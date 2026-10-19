import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from '../ui/Icon';
import { ThemedText } from '../ui/primitives';
import type { FeatureKey } from './features';
import { openPro, useFeature } from './ProProvider';

/**
 * Renders `children` when `feature` is unlocked; otherwise `fallback`, or a compact locked row
 * (`label` + PRO) that opens the PRO screen.
 */
export function ProGate({
  feature,
  label,
  fallback,
  children,
}: {
  feature: FeatureKey;
  label?: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const unlocked = useFeature(feature);
  if (unlocked) return children;
  return fallback ?? <LockedRow label={label} />;
}

function LockedRow({ label }: { label?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable
      onPress={openPro}
      accessibilityRole="button"
      accessibilityLabel={t('pro.locked', { feature: label ?? '' })}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      {label ? (
        <ThemedText variant="small" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <View style={[styles.badge, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Icon name="lock" size={14} color={theme.colors.warning} />
        <ThemedText variant="caption" bold color={theme.colors.warning}>
          PRO
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minHeight: 28 },
  label: { flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADII.pill,
  },
});
