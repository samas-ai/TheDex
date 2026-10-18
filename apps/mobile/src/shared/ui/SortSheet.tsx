import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Sheet } from './Sheet';
import { ThemedText } from './primitives';

export interface SortState<K extends string> {
  readonly key: K;
  readonly direction: 'asc' | 'desc';
}

/** Sort keys of a list; picking the active key again flips the direction (`onSelect`). */
export function SortSheet<K extends string>({
  visible,
  keys,
  labelOf,
  sort,
  onSelect,
  onClose,
}: {
  visible: boolean;
  keys: readonly K[];
  labelOf: (key: K) => string;
  sort: SortState<K>;
  onSelect: (key: K) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Sheet visible={visible} title={t('common.sort')} onClose={onClose}>
      {keys.map((key) => {
        const active = sort.key === key;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent' },
            ]}
          >
            <ThemedText bold={active} color={active ? theme.colors.primary : undefined}>
              {labelOf(key)}
            </ThemedText>
            {active ? (
              <View style={styles.direction}>
                <ThemedText muted variant="small">
                  {t(sort.direction === 'asc' ? 'common.ascending' : 'common.descending')}
                </ThemedText>
                <ThemedText color={theme.colors.primary}>
                  {sort.direction === 'asc' ? '↑' : '↓'}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADII.sm,
  },
  direction: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
});
