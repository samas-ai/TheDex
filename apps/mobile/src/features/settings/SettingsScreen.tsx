import { Link, router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { gameLangChain, listGameLanguages, SPRITE_STYLES } from '@thedex/db';
import { SPACING, THEME_PREFERENCES } from '@thedex/ui-tokens';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { en, type Translations } from '../../shared/i18n/locales/en';
import { unlockedTheme } from '../../shared/pro/features';
import { useFeature, useRequirePro } from '../../shared/pro/ProProvider';
import { UI_LANGUAGES } from '../../shared/settings/settings';
import { useSettings } from '../../shared/settings/SettingsProvider';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Card, Chip, InfoRow, Section, styles as ui, ThemedText } from '../../shared/ui/primitives';
import { BackupSection } from './BackupSection';
import { MediaSection } from './MediaSection';

type LanguageKey = keyof Translations['languages'];
const isLanguageKey = (code: string): code is LanguageKey => Object.hasOwn(en.languages, code);

/**
 * RNF04 (theme, sprite style), RNF05 (UI vs game-data language), RF01.2, RNF02 (media) and RNF06
 * (backup). The AMOLED theme is PRO (RNF08).
 */
export function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db, dataVersion } = useAppDatabase();
  const { settings, updateSettings } = useSettings();
  const { game } = useGame();
  const amoled = useFeature('theme.amoled');
  const requirePro = useRequirePro();
  // A locked AMOLED choice shows as the dark theme it falls back to.
  const themeChoice = unlockedTheme(settings.theme, amoled);
  const { data: gameLanguages } = useAsync(() => listGameLanguages(db), [db]);
  const label = (code: string) => (isLanguageKey(code) ? t(`languages.${code}`) : code);

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: t('nav.settings') }} />

      <Section title={t('settings.appearance')}>
        <Card>
          <ThemedText bold>{t('settings.theme')}</ThemedText>
          <View style={ui.wrap}>
            {THEME_PREFERENCES.map((preference) => {
              const label = t(`settings.themes.${preference}`);
              const locked = preference === 'amoled' && !amoled;
              return (
                <Chip
                  key={preference}
                  label={locked ? t('pro.badge', { label }) : label}
                  selected={themeChoice === preference}
                  onPress={() =>
                    preference === 'amoled'
                      ? requirePro('theme.amoled', () => updateSettings({ theme: preference }))
                      : updateSettings({ theme: preference })
                  }
                />
              );
            })}
          </View>
          <ThemedText bold>{t('settings.spriteStyle')}</ThemedText>
          <View style={ui.wrap}>
            {SPRITE_STYLES.map((style) => (
              <Chip
                key={style}
                label={t(`settings.spriteStyles.${style}`)}
                selected={settings.spriteStyle === style}
                onPress={() => updateSettings({ spriteStyle: style })}
              />
            ))}
          </View>
        </Card>
      </Section>

      <Section title={t('settings.language')}>
        <Card>
          <ThemedText bold>{t('settings.uiLanguage')}</ThemedText>
          <View style={ui.wrap}>
            <Chip
              label={t('settings.system')}
              selected={settings.uiLang === 'system'}
              onPress={() => updateSettings({ uiLang: 'system' })}
            />
            {UI_LANGUAGES.map((language) => (
              <Chip
                key={language}
                label={label(language)}
                selected={settings.uiLang === language}
                onPress={() => updateSettings({ uiLang: language })}
              />
            ))}
          </View>
          <ThemedText bold>{t('settings.gameLanguage')}</ThemedText>
          <ThemedText variant="small" muted>
            {t('settings.gameLanguageHint')}
          </ThemedText>
          <View style={ui.wrap}>
            {(gameLanguages ?? []).map((code) => (
              <Chip
                key={code}
                label={label(code)}
                selected={settings.gameLangs[0] === code}
                onPress={() => updateSettings({ gameLangs: gameLangChain(code) })}
              />
            ))}
          </View>
        </Card>
      </Section>

      <Section title={t('settings.game')}>
        <Card>
          <Chip label={game.name} onPress={() => router.push('/game')} />
        </Card>
      </Section>

      <MediaSection />

      <BackupSection />

      <Section title={t('settings.about')}>
        <Card>
          <InfoRow label="TheDex" value={t('settings.dataVersion', { version: dataVersion })} />
          {__DEV__ ? (
            <Link href="/diagnostics" style={{ color: theme.colors.primary }}>
              {t('nav.diagnostics')}
            </Link>
          ) : null}
        </Card>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
});
