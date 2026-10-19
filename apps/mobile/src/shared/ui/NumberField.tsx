import { useEffect, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { FONT_SIZES, RADII, SPACING } from '@thedex/ui-tokens';
import { parseClamped } from '../options';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Compact integer input clamped to [min, max]: valid values are reported as they are typed,
 * and the text snaps back to the current value when the field loses focus.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  width = 56,
  accessibilityLabel,
  editable = true,
  invalid,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  width?: number;
  accessibilityLabel: string;
  editable?: boolean;
  /** Draws the field in the danger color (e.g. EVs over the total). */
  invalid?: boolean;
}) {
  const theme = useTheme();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <TextInput
      value={text}
      onChangeText={(next) => {
        setText(next);
        const parsed = parseClamped(next, min, max);
        if (parsed !== null && parsed !== value) onChange(parsed);
      }}
      onBlur={() => setText(String(value))}
      keyboardType="number-pad"
      selectTextOnFocus
      editable={editable}
      maxLength={String(max).length}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.input,
        {
          width,
          color: editable ? theme.colors.text : theme.colors.textMuted,
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: invalid ? theme.colors.danger : 'transparent',
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: RADII.sm,
    borderWidth: 1,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    fontSize: FONT_SIZES.body,
    textAlign: 'center',
  },
});
