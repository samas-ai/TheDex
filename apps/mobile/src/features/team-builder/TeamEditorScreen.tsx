import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { assertGeneration } from '@thedex/engine';
import { getPokemonProfile, newTeamMember, TEAM_SIZE } from '@thedex/db';
import { FONT_SIZES, FONT_WEIGHTS, RADII, SPACING } from '@thedex/ui-tokens';
import { PokemonPicker } from '../../entities/pokemon/PokemonPicker';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useGameContextFor } from '../../shared/game/useGameContextFor';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { PickerModal } from '../../shared/ui/PickerModal';
import { TabBar } from '../../shared/ui/TabBar';
import { Button, Card, InfoRow, Loading, Message, ThemedText } from '../../shared/ui/primitives';
import { CoverageView } from './CoverageView';
import { EmptySlot, MemberCard } from './MemberCard';
import { slotDefaults } from './team-logic';
import { useTeam } from './team-store';
import { TeamShareView } from './TeamShareView';
import { useTeamDetails } from './useTeamDetails';

const TABS = ['team', 'coverage', 'share'] as const;
type EditorTab = (typeof TABS)[number];

/** RF08.1–RF08.4: a team's slots, its coverage analysis and its export. */
export function TeamEditorScreen({ teamId }: { teamId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { games } = useGame();
  const { team, update, remove } = useTeam(teamId);
  const game = useGameContextFor(team?.gameId);
  const details = useTeamDetails(team?.members ?? [], game?.ctx ?? null);
  const [tab, setTab] = useState<EditorTab>('team');
  const [picker, setPicker] = useState<'pokemon' | 'game' | null>(null);
  const accent = useTypeAccent(null);

  if (team === undefined) return <Loading />;
  if (team === null) return <Message text={t('teamEditor.notFound')} />;
  const gen = assertGeneration(team.generationId);
  const gameName = games.find((g) => g.id === team.gameId)?.name ?? '';

  const addMember = async (pokemonId: number) => {
    setPicker(null);
    if (!game) return;
    const profile = await getPokemonProfile(db, pokemonId, game.ctx);
    const defaults = slotDefaults(profile?.abilities ?? [], profile?.species.genderRate ?? -1, gen);
    const index = team.members.length;
    update((current) => ({
      ...current,
      members: [...current.members, { ...newTeamMember(pokemonId), ...defaults }].slice(
        0,
        TEAM_SIZE,
      ),
    }));
    router.push(`/team/${team.id}/${index}`);
  };

  const confirmDelete = () =>
    Alert.alert(t('teamEditor.deleteTitle'), t('teamEditor.deleteMessage', { name: team.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void remove();
          router.back();
        },
      },
    ]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: team.name }} />
      <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Card>
            <TextInput
              value={team.name}
              onChangeText={(name) => update((current) => ({ ...current, name }))}
              placeholder={t('teamEditor.name')}
              placeholderTextColor={theme.colors.textMuted}
              accessibilityLabel={t('teamEditor.name')}
              maxLength={60}
              style={[styles.name, { color: theme.colors.text }]}
            />
            <InfoRow
              label={t('teams.game')}
              value={
                <ThemedText color={theme.colors.primary} onPress={() => setPicker('game')}>
                  {gameName || t('common.generation', { number: gen })}
                </ThemedText>
              }
            />
            <View style={styles.formatRow}>
              <ThemedText muted style={styles.formatLabel}>
                {t('teamEditor.format')}
              </ThemedText>
              <TextInput
                value={team.format ?? ''}
                onChangeText={(format) =>
                  update((current) => ({
                    ...current,
                    format: format.trim() === '' ? null : format,
                  }))
                }
                placeholder={`gen${gen}ou`}
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t('teamEditor.format')}
                maxLength={40}
                style={[
                  styles.format,
                  { color: theme.colors.text, backgroundColor: theme.colors.surfaceVariant },
                ]}
              />
            </View>
          </Card>
        </View>
        <TabBar
          tabs={TABS.map((key) => ({ key, label: t(`teamEditor.tabs.${key}`) }))}
          active={tab}
          onChange={setTab}
          accent={accent}
        />
        <View style={styles.content}>
          {!game || !details ? (
            <Loading />
          ) : tab === 'team' ? (
            <View style={styles.slots}>
              {team.members.map((member, index) => (
                <MemberCard
                  key={index}
                  member={member}
                  details={details}
                  onPress={() => router.push(`/team/${team.id}/${index}`)}
                />
              ))}
              {team.members.length < TEAM_SIZE ? (
                <EmptySlot onPress={() => setPicker('pokemon')} />
              ) : null}
              <View style={styles.danger}>
                <Button
                  label={t('teamEditor.delete')}
                  color={theme.colors.surfaceVariant}
                  textColor={theme.colors.danger}
                  onPress={confirmDelete}
                />
              </View>
            </View>
          ) : tab === 'coverage' ? (
            <CoverageView members={team.members} details={details} gen={gen} />
          ) : (
            <TeamShareView team={team} details={details} gen={gen} gameName={gameName} />
          )}
        </View>
      </ScrollView>
      {game ? (
        <PokemonPicker
          visible={picker === 'pokemon'}
          title={t('teamEditor.addPokemon')}
          ctx={game.ctx}
          onSelect={(entry) => void addMember(entry.id)}
          onClose={() => setPicker(null)}
        />
      ) : null}
      <PickerModal
        visible={picker === 'game'}
        title={t('teams.game')}
        items={games.map((g) => ({
          key: g.id,
          title: g.name,
          subtitle: t('common.generation', { number: g.generationId }),
        }))}
        selected={team.gameId}
        onSelect={(id) => {
          setPicker(null);
          const chosen = games.find((g) => g.id === id);
          if (chosen) {
            update((current) => ({
              ...current,
              gameId: chosen.id,
              generationId: chosen.generationId,
            }));
          }
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingBottom: SPACING.xxl },
  header: { padding: SPACING.lg, paddingBottom: SPACING.sm },
  name: {
    fontSize: FONT_SIZES.headline,
    fontWeight: FONT_WEIGHTS.bold,
    paddingVertical: SPACING.xs,
  },
  formatRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  formatLabel: { flex: 2 },
  format: {
    flex: 3,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  content: { padding: SPACING.lg },
  slots: { gap: SPACING.sm },
  danger: { marginTop: SPACING.lg },
});
