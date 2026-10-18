import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SPACING } from '@thedex/ui-tokens';
import { ThemedText } from './primitives';
import { SearchField } from './SearchField';

/** Search box, filter/sort chips and the result count above an encyclopedia list. */
export function ListToolbar({
  query,
  onQueryChange,
  placeholder,
  count,
  children,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
  count: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.toolbar}>
      <SearchField value={query} onChangeText={onQueryChange} placeholder={placeholder} />
      <View style={styles.chips}>
        {children}
        <ThemedText variant="caption" muted style={styles.count}>
          {count}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.sm },
  chips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  count: { marginLeft: 'auto', marginBottom: SPACING.sm },
});
