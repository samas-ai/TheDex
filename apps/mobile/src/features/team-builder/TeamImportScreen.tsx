import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { assertGeneration, parseShowdownTeams } from '@thedex/engine';
import {
  createUlid,
  getPokemonProfile,
  listTeams,
  nextTeamSortOrder,
  resolveGameContext,
  resolveShowdownNames,
  TEAM_SIZE,
  type Team,
  type TeamMember,
} from '@thedex/db';
import { FONT_SIZES, RADII, SPACING } from '@thedex/ui-tokens';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { remainingTeams } from '../../shared/pro/features';
import { openPro, useFeature } from '../../shared/pro/ProProvider';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { PickerModal } from '../../shared/ui/PickerModal';
import { Button, Card, InfoRow, Section, ThemedText } from '../../shared/ui/primitives';
import {
  fromShowdownSet,
  gameForFormat,
  showdownNamesOf,
  slotDefaults,
  withSlotDefaults,
} from './team-logic';
import { teamStore } from './team-store';

/** RF08.4: imports teams pasted in Showdown's format (one set, a team or a whole backup). */
export function TeamImportScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx, games } = useGame();
  const unlimited = useFeature('team.unlimited');
  const [text, setText] = useState('');
  const [chosenGameId, setChosenGameId] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseShowdownTeams(text), [text]);
  const suggested = gameForFormat(parsed[0]?.format ?? null, games, ctx.gameId);
  const gameId = chosenGameId ?? suggested;
  const game = games.find((g) => g.id === gameId);
  const setCount = parsed.reduce((sum, team) => sum + team.sets.length, 0);

  const paste = async () => setText(await Clipboard.getStringAsync());

  const runImport = async () => {
    if (!game) return;
    setBusy(true);
    try {
      const gen = assertGeneration(game.generationId);
      const ids = await resolveShowdownNames(db, showdownNamesOf(parsed.flatMap((p) => p.sets)));
      const gameCtx = await resolveGameContext(db, game.id, ['en']);
      const unresolved = new Set<string>();
      let sortOrder = await nextTeamSortOrder(db);
      const ready: Team[] = [];
      for (const [index, imported] of parsed.entries()) {
        const members: TeamMember[] = [];
        for (const set of imported.sets) {
          const result = fromShowdownSet(set, ids, gen);
          result.unresolved.forEach((name) => unresolved.add(name));
          if (!result.member || members.length >= TEAM_SIZE) continue;
          const profile = await getPokemonProfile(db, result.member.pokemonId, gameCtx);
          members.push(
            withSlotDefaults(
              result.member,
              slotDefaults(profile?.abilities ?? [], profile?.species.genderRate ?? -1, gen),
            ),
          );
        }
        if (members.length === 0) continue;
        const now = Date.now();
        const team: Team = {
          id: createUlid(now, Math.random),
          name: imported.name ?? t('teams.importedName', { number: index + 1 }),
          format: imported.format,
          gameId: game.id,
          generationId: game.generationId,
          members,
          notes: null,
          sortOrder: sortOrder++,
          createdAt: now,
          updatedAt: now,
        };
        ready.push(team);
      }
      // The free plan's team limit (RNF08) counts what this import would add.
      const remaining = remainingTeams((await listTeams(db)).length, unlimited);
      if (ready.length > remaining) {
        Alert.alert(t('nav.pro'), t('teams.importLimit', { count: ready.length, remaining }), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('pro.buy'), onPress: openPro },
        ]);
        return;
      }
      const created: string[] = [];
      for (const team of ready) {
        await teamStore.save(db, team);
        created.push(team.id);
      }
      const done = () => {
        if (created.length === 1) router.replace(`/team/${created[0]}`);
        else router.back();
      };
      if (created.length === 0) {
        Alert.alert(t('teams.importFailed'));
      } else if (unresolved.size > 0) {
        Alert.alert(
          t('teams.imported', { count: created.length }),
          t('teams.unresolved', { names: [...unresolved].join(', ') }),
          [{ text: t('common.done'), onPress: done }],
        );
      } else {
        done();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <ThemedText muted>{t('teams.importHint')}</ThemedText>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={'Garchomp @ Rocky Helmet\nAbility: Rough Skin\n- Earthquake'}
        placeholderTextColor={theme.colors.textMuted}
        textAlignVertical="top"
        accessibilityLabel={t('teams.importText')}
        style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surface }]}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label={t('teams.paste')}
            color={theme.colors.surfaceVariant}
            textColor={theme.colors.text}
            onPress={() => void paste()}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={t('common.clear')}
            color={theme.colors.surfaceVariant}
            textColor={theme.colors.text}
            onPress={() => setText('')}
          />
        </View>
      </View>
      <Section title={t('teams.importInto')}>
        <Card>
          <InfoRow
            label={t('teams.game')}
            value={
              <ThemedText color={theme.colors.primary} onPress={() => setPicking(true)}>
                {game?.name ?? '—'}
              </ThemedText>
            }
          />
          <InfoRow
            label={t('teams.found')}
            value={t('teams.foundValue', { teams: parsed.length, sets: setCount })}
          />
        </Card>
      </Section>
      <Button
        label={t('teams.importAction')}
        disabled={busy || setCount === 0}
        onPress={() => void runImport()}
      />
      <PickerModal
        visible={picking}
        title={t('teams.game')}
        items={games.map((g) => ({
          key: g.id,
          title: g.name,
          subtitle: t('common.generation', { number: g.generationId }),
        }))}
        selected={gameId}
        onSelect={(id) => {
          if (id !== null) setChosenGameId(id);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  input: {
    minHeight: 200,
    borderRadius: RADII.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.small,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  row: { flexDirection: 'row', gap: SPACING.md },
  flex: { flex: 1 },
});
