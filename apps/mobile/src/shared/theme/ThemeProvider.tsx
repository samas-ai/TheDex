import type { Theme as NavigationTheme } from 'expo-router';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { resolveThemeName, THEMES, type Theme } from '@thedex/ui-tokens';
import { unlockedTheme } from '../pro/features';
import { useFeature } from '../pro/ProProvider';
import { useSettings } from '../settings/SettingsProvider';

const ThemeContext = createContext<Theme>(THEMES.light);

/**
 * Light / dark / AMOLED from `settings.theme`, following the OS when `system` (RNF04). AMOLED is
 * PRO (RNF08): while locked, a stored AMOLED choice shows the dark theme.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const amoled = useFeature('theme.amoled');
  const scheme = useColorScheme();
  const theme = THEMES[resolveThemeName(unlockedTheme(settings.theme, amoled), scheme)];
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** React Navigation theme (headers, screen background) derived from the tokens. */
export function useNavigationTheme(base: NavigationTheme): NavigationTheme {
  const theme = useTheme();
  return useMemo(
    () => ({
      ...base,
      dark: theme.isDark,
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.primary,
      },
    }),
    [base, theme],
  );
}
