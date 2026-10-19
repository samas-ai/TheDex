import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { SPACING } from '@thedex/ui-tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { ThemedText } from './primitives';

/** Full-height modal with a title bar (pickers: Pokémon, moves, items, natures…). */
export function FullScreenModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.root,
          {
            backgroundColor: theme.colors.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <View
          style={[
            styles.header,
            { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border },
          ]}
        >
          <ThemedText variant="title" bold style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={12}
          >
            <Icon name="close" />
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1 },
});
