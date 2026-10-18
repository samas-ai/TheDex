import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';

/** Search box of the list screens (RNF07: results come from the FTS index). */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: theme.colors.surface }]}>
      <Icon name="magnify" size={20} color={theme.colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        returnKeyType="search"
        style={[styles.input, { color: theme.colors.text }]}
      />
      {value !== '' ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel={t('common.clear')}
          hitSlop={8}
        >
          <Icon name="close-circle" size={18} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
  },
  input: { flex: 1, paddingVertical: SPACING.sm + 2, fontSize: 16 },
});
