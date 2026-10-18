import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getPokemonProfile } from '@thedex/db';
import { SPACING } from '@thedex/ui-tokens';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { TabBar } from '../../shared/ui/TabBar';
import { Button, Loading, Message } from '../../shared/ui/primitives';
import { ProfileHeader } from './ProfileHeader';
import { AboutTab } from './tabs/AboutTab';
import { EvolutionTab } from './tabs/EvolutionTab';
import { LocationsTab } from './tabs/LocationsTab';
import { MatchupsTab } from './tabs/MatchupsTab';
import { MovesTab } from './tabs/MovesTab';
import { StatsTab } from './tabs/StatsTab';

const TABS = ['about', 'stats', 'matchups', 'evolution', 'moves', 'locations'] as const;
type ProfileTab = (typeof TABS)[number];

/** RF02: detailed profile, resolved for the selected game (typing, stats, moves, locations). */
export function ProfileScreen({ pokemonId }: { pokemonId: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const profile = useAsync(() => getPokemonProfile(db, pokemonId, ctx), [db, ctx, pokemonId]);
  const [tab, setTab] = useState<ProfileTab>('about');
  const [shiny, setShiny] = useState(false);
  const data = profile.data && profile.data.id === pokemonId ? profile.data : null;
  const accent = useTypeAccent(data?.types[0]);
  useEffect(() => setShiny(false), [pokemonId]);

  const screenOptions = {
    title: data?.name ?? '',
    headerStyle: { backgroundColor: accent.tint },
    headerTintColor: accent.text,
    headerShadowVisible: false,
  };

  if (profile.error) {
    return (
      <Message
        text={t('common.error', { message: profile.error.message })}
        action={<Button label={t('common.retry')} onPress={profile.reload} />}
      />
    );
  }
  if (!data) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={screenOptions} />
        {profile.loading ? <Loading /> : <Message text={t('profile.notFound')} />}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={screenOptions} />
      <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={styles.scroll}>
        <ProfileHeader
          profile={data}
          accent={accent}
          shiny={shiny}
          onToggleShiny={() => setShiny((value) => !value)}
        />
        <TabBar
          tabs={TABS.map((key) => ({ key, label: t(`profile.tabs.${key}`) }))}
          active={tab}
          onChange={setTab}
          accent={accent}
        />
        <View style={styles.content}>
          {tab === 'about' ? <AboutTab profile={data} accent={accent} /> : null}
          {tab === 'stats' ? <StatsTab profile={data} accent={accent} /> : null}
          {tab === 'matchups' ? <MatchupsTab profile={data} /> : null}
          {tab === 'evolution' ? <EvolutionTab profile={data} accent={accent} /> : null}
          {tab === 'moves' ? <MovesTab profile={data} accent={accent} /> : null}
          {tab === 'locations' ? <LocationsTab profile={data} accent={accent} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingBottom: SPACING.xxl },
  content: { padding: SPACING.lg },
});
