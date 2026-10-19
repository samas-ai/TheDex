import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { CatalogProvider } from '../entities/catalog/CatalogProvider';
import { DatabaseProvider } from '../shared/db/DatabaseProvider';
import { GameProvider } from '../shared/game/GameProvider';
import { initI18n } from '../shared/i18n/i18n';
import { MediaProvider } from '../shared/media/MediaProvider';
import { ProProvider } from '../shared/pro/ProProvider';
import { resolveUiLanguage } from '../shared/settings/settings';
import { SettingsProvider, useSettings } from '../shared/settings/SettingsProvider';
import { ThemeProvider, useNavigationTheme, useTheme } from '../shared/theme/ThemeProvider';

/**
 * Provider order: databases → user settings → PRO plan (the theme needs `theme.amoled`) → UI
 * language → theme → selected game (its GameContext) → media cache → per-game lookup tables →
 * screens.
 */
export default function RootLayout() {
  return (
    <DatabaseProvider>
      <SettingsProvider>
        <ProProvider>
          <LocalizedApp />
        </ProProvider>
      </SettingsProvider>
    </DatabaseProvider>
  );
}

function LocalizedApp() {
  const { settings, deviceLanguage } = useSettings();
  const language = resolveUiLanguage(settings.uiLang, deviceLanguage);
  // Initialized once with the startup language. Later switches go through an effect:
  // changeLanguage notifies every useTranslation(), which must not happen while rendering.
  const [i18n] = useState(() => initI18n(language));
  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [i18n, language]);
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </I18nextProvider>
  );
}

function ThemedApp() {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigationTheme = useNavigationTheme(theme.isDark ? DarkTheme : DefaultTheme);
  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <GameProvider>
        <MediaProvider>
          <CatalogProvider>
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: theme.colors.background },
                headerTintColor: theme.colors.text,
              }}
            >
              <Stack.Screen
                name="(tabs)"
                options={{ headerShown: false, title: t('nav.pokedex') }}
              />
              <Stack.Screen
                name="game"
                options={{ presentation: 'modal', title: t('nav.selectGame') }}
              />
              <Stack.Screen
                name="team-import"
                options={{ presentation: 'modal', title: t('nav.importTeam') }}
              />
              <Stack.Screen name="pro" options={{ presentation: 'modal', title: t('nav.pro') }} />
            </Stack>
          </CatalogProvider>
        </MediaProvider>
      </GameProvider>
    </NavigationThemeProvider>
  );
}
