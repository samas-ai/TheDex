import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADII, SPACING, withAlpha } from '@thedex/ui-tokens';
import { useTheme } from '../theme/ThemeProvider';
import { ThemedText } from './primitives';

interface SheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** Pinned under the scrollable content (e.g. Reset / Done). */
  readonly footer?: ReactNode;
}

/** Bottom sheet built on RN Modal (filters, sort, ability description). */
export function Sheet({ visible, title, onClose, children, footer }: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withAlpha(theme.colors.scrim, 0.45) },
          ]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="close"
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + SPACING.lg },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          <ThemedText variant="title" bold style={styles.title}>
            {title}
          </ThemedText>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: RADII.lg,
    borderTopRightRadius: RADII.lg,
    paddingTop: SPACING.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: SPACING.sm },
  title: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  footer: { flexDirection: 'row', gap: SPACING.md, paddingHorizontal: SPACING.lg },
});
