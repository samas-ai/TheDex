import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { useTheme } from '../theme/ThemeProvider';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type IconColor = ComponentProps<typeof MaterialCommunityIcons>['color'];

/** Material Community Icons glyph (bundled font: works offline), in the theme text color. */
export function Icon({
  name,
  size = 22,
  color,
}: {
  name: IconName;
  size?: number;
  color?: IconColor;
}) {
  const theme = useTheme();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? theme.colors.text} />;
}
