import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SPACING, type TypeAccent } from '@thedex/ui-tokens';
import { useTheme } from '../theme/ThemeProvider';
import { ThemedText } from './primitives';

/** Horizontally scrollable tabs underlined in the screen's type accent (RNF03). */
export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  accent,
}: {
  tabs: readonly { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
  accent: TypeAccent;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.background,
        borderBottomColor: theme.colors.border,
        borderBottomWidth: StyleSheet.hairlineWidth,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bar}
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.tab, { borderBottomColor: selected ? accent.base : 'transparent' }]}
            >
              <ThemedText bold={selected} color={selected ? accent.text : theme.colors.textMuted}>
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: SPACING.sm },
  tab: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 3 },
});
