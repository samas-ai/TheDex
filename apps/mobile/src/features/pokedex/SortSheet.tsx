import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { POKEDEX_SORT_KEYS, type PokedexSortKey } from '@thedex/db';
import { SPACING } from '@thedex/ui-tokens';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Sheet } from '../../shared/ui/Sheet';
import { ThemedText } from '../../shared/ui/primitives';
import { nextSort, type PokedexSort } from './pokedex-state';

/** RF01.4: number (regional/national), name, height, weight and every base stat. */
export function SortSheet({
  visible,
  sort,
  onChange,
  onClose,
}: {
  visible: boolean;
  sort: PokedexSort;
  onChange: (sort: PokedexSort) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const select = (key: PokedexSortKey) => onChange(nextSort(sort, key));
  return (
    <Sheet visible={visible} title={t('pokedex.sort')} onClose={onClose}>
      {POKEDEX_SORT_KEYS.map((key) => {
        const active = sort.key === key;
        return (
          <Pressable
            key={key}
            onPress={() => select(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent' },
            ]}
          >
            <ThemedText bold={active} color={active ? theme.colors.primary : undefined}>
              {t(`pokedex.sortKeys.${key}`)}
            </ThemedText>
            {active ? (
              <View style={styles.direction}>
                <ThemedText muted variant="small">
                  {t(sort.direction === 'asc' ? 'pokedex.ascending' : 'pokedex.descending')}
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
    borderRadius: 8,
  },
  direction: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
});
