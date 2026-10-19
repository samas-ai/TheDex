import { FlashList } from '@shopify/flash-list';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { filterOptions, type PickerOption } from '../options';
import { useTheme } from '../theme/ThemeProvider';
import { FullScreenModal } from './FullScreenModal';
import { Icon } from './Icon';
import { Message, ThemedText } from './primitives';
import { SearchField } from './SearchField';

export interface PickerItem<K> extends PickerOption<K> {
  readonly leading?: ReactNode;
  readonly right?: ReactNode;
  /** Shown dimmed (e.g. a move the Pokémon cannot learn). */
  readonly dimmed?: boolean;
}

/**
 * Searchable list of choices in a full-screen modal. `header` sits under the search box
 * (filter chips); `allowNone` adds a first row that clears the value.
 */
export function PickerModal<K extends string | number>({
  visible,
  title,
  items,
  selected,
  onSelect,
  onClose,
  header,
  allowNone,
  emptyText,
}: {
  visible: boolean;
  title: string;
  items: readonly PickerItem<K>[];
  selected?: K | null;
  onSelect: (key: K | null) => void;
  onClose: () => void;
  header?: ReactNode;
  allowNone?: boolean;
  emptyText?: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterOptions(items, query), [items, query]);
  const close = () => {
    setQuery('');
    onClose();
  };
  const choose = (key: K | null) => {
    setQuery('');
    onSelect(key);
  };

  return (
    <FullScreenModal visible={visible} title={title} onClose={close}>
      <View style={styles.toolbar}>
        <SearchField value={query} onChangeText={setQuery} placeholder={t('common.search')} />
        {header}
      </View>
      <FlashList
        data={filtered}
        keyExtractor={(item) => String(item.key)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          allowNone && query === '' ? (
            <Row
              title={t('common.none')}
              selected={selected === null || selected === undefined}
              onPress={() => choose(null)}
            />
          ) : null
        }
        ListEmptyComponent={<Message text={emptyText ?? t('common.noMatches')} />}
        renderItem={({ item }) => (
          <Row
            title={item.title}
            subtitle={item.subtitle}
            leading={item.leading}
            right={item.right}
            dimmed={item.dimmed}
            selected={item.key === selected}
            onPress={() => choose(item.key)}
          />
        )}
        extraData={selected}
      />
    </FullScreenModal>
  );
}

function Row({
  title,
  subtitle,
  leading,
  right,
  dimmed,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  leading?: ReactNode;
  right?: ReactNode;
  dimmed?: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed || selected ? theme.colors.surfaceVariant : theme.colors.surface,
          opacity: dimmed ? 0.55 : 1,
        },
      ]}
    >
      {leading}
      <View style={styles.body}>
        <ThemedText bold={selected}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText variant="caption" muted>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right}
      {selected ? <Icon name="check" size={20} color={theme.colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toolbar: { padding: SPACING.lg, paddingBottom: SPACING.sm, gap: SPACING.sm },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: 48,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.xs,
    borderRadius: RADII.md,
  },
  body: { flex: 1, gap: 2 },
});
