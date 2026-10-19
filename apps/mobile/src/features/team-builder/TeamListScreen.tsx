import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { createUlid, listTeams, nextTeamSortOrder, TEAM_SIZE, type Team } from '@thedex/db';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { PokemonSprite } from '../../entities/pokemon/PokemonSprite';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Icon } from '../../shared/ui/Icon';
import { Button, Card, Loading, Message, ThemedText } from '../../shared/ui/primitives';
import { teamStore, useTeamsVersion } from './team-store';

/** RF08.1: the user's teams, each built for a game; new teams start in the selected game. */
export function TeamListScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx, games } = useGame();
  const version = useTeamsVersion();
  const teams = useAsync(() => listTeams(db), [db, version]);
  const gameName = (id: number | null) => games.find((game) => game.id === id)?.name ?? '';

  const create = async () => {
    const now = Date.now();
    const team: Team = {
      id: createUlid(now, Math.random),
      name: t('teams.defaultName', { number: (teams.data?.length ?? 0) + 1 }),
      format: null,
      gameId: ctx.gameId,
      generationId: ctx.generationId,
      members: [],
      notes: null,
      sortOrder: await nextTeamSortOrder(db),
      createdAt: now,
      updatedAt: now,
    };
    await teamStore.save(db, team);
    router.push(`/team/${team.id}`);
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: t('nav.teams') }} />
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label={t('teams.new')} onPress={() => void create()} />
        </View>
        <View style={styles.flex}>
          <Button
            label={t('teams.import')}
            color={theme.colors.surfaceVariant}
            textColor={theme.colors.text}
            onPress={() => router.push('/team-import')}
          />
        </View>
      </View>
      {!teams.data ? (
        <Loading />
      ) : teams.data.length === 0 ? (
        <Message text={t('teams.empty')} />
      ) : (
        teams.data.map((team) => (
          <Pressable
            key={team.id}
            onPress={() => router.push(`/team/${team.id}`)}
            accessibilityRole="button"
            accessibilityLabel={team.name}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Card style={styles.card}>
              <View style={styles.title}>
                <ThemedText bold variant="title" numberOfLines={1} style={styles.flex}>
                  {team.name}
                </ThemedText>
                <Icon name="chevron-right" color={theme.colors.textMuted} />
              </View>
              <ThemedText variant="caption" muted>
                {[gameName(team.gameId), team.format].filter(Boolean).join(' · ')}
              </ThemedText>
              <View style={styles.sprites}>
                {Array.from({ length: TEAM_SIZE }, (_, index) => {
                  const member = team.members[index];
                  return (
                    <View
                      key={index}
                      style={[styles.slot, { backgroundColor: theme.colors.surfaceVariant }]}
                    >
                      {member ? (
                        <PokemonSprite
                          pokemonId={member.pokemonId}
                          style="pixel"
                          shiny={member.shiny}
                          size={44}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  actions: { flexDirection: 'row', gap: SPACING.md },
  flex: { flex: 1 },
  card: { gap: SPACING.xs },
  title: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sprites: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.xs },
  slot: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 52,
    borderRadius: RADII.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
