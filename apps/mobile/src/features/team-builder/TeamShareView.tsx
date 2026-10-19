import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useRef, useState, type ComponentRef } from 'react';
import { Alert, Platform, Share, StyleSheet, TextInput, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useTranslation } from 'react-i18next';
import { exportShowdownTeam, type Generation } from '@thedex/engine';
import { getShowdownNames, type Team } from '@thedex/db';
import { FONT_SIZES, RADII, SPACING } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { PokemonSprite } from '../../entities/pokemon/PokemonSprite';
import { TypeBadge } from '../../entities/pokemon/TypeBadge';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { Button, Loading, Message, Section, ThemedText } from '../../shared/ui/primitives';
import { showdownIdsOf, toShowdownSet } from './team-logic';
import type { TeamDetails } from './useTeamDetails';

/**
 * RF08.4: the team as Showdown text (copy / share) and as an image card for sharing, both
 * built offline from the game DB.
 */
export function TeamShareView({
  team,
  details,
  gen,
  gameName,
}: {
  team: Team;
  details: TeamDetails;
  gen: Generation;
  gameName: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const card = useRef<ComponentRef<typeof View>>(null);
  const [sharing, setSharing] = useState(false);
  const idsKey = JSON.stringify(showdownIdsOf(team.members));
  const names = useAsync(
    () => getShowdownNames(db, showdownIdsOf(team.members)),
    // idsKey stands for the members' ids.
    [db, idsKey],
  );
  if (team.members.length === 0) return <Message text={t('share.empty')} />;
  if (!names.data) return <Loading />;

  const text = exportShowdownTeam(
    team.members.map((member) => toShowdownSet(member, names.data!, gen)),
    { name: team.name, format: team.format },
    { defaultEv: gen <= 2 ? 252 : 0 },
  );

  const shareImage = async () => {
    setSharing(true);
    try {
      const uri = await captureRef(card, { format: 'png', result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: team.name,
        });
      } else {
        Alert.alert(t('share.unavailable'));
      }
    } catch (e) {
      Alert.alert(t('common.error', { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setSharing(false);
    }
  };

  return (
    <View>
      <Section title={t('share.showdown')}>
        <TextInput
          value={text}
          multiline
          editable={false}
          scrollEnabled={false}
          accessibilityLabel={t('share.showdown')}
          style={[styles.text, { color: theme.colors.text, backgroundColor: theme.colors.surface }]}
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              label={t('share.copy')}
              onPress={() => {
                void Clipboard.setStringAsync(text).then(() => Alert.alert(t('share.copied')));
              }}
            />
          </View>
          <View style={styles.flex}>
            <Button
              label={t('share.shareText')}
              color={theme.colors.surfaceVariant}
              textColor={theme.colors.text}
              onPress={() => void Share.share({ message: text, title: team.name })}
            />
          </View>
        </View>
      </Section>
      <Section title={t('share.card')}>
        <View ref={card} collapsable={false}>
          <TeamCard team={team} details={details} gameName={gameName} />
        </View>
        <Button
          label={t('share.shareImage')}
          disabled={sharing}
          onPress={() => void shareImage()}
        />
      </Section>
    </View>
  );
}

/** The shareable summary card (captured as PNG). */
function TeamCard({
  team,
  details,
  gameName,
}: {
  team: Team;
  details: TeamDetails;
  gameName: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <ThemedText variant="title" bold>
        {team.name}
      </ThemedText>
      <ThemedText variant="caption" muted>
        {[gameName, team.format].filter(Boolean).join(' · ')}
      </ThemedText>
      <View style={styles.grid}>
        {team.members.map((member, index) => (
          <CardMember key={index} member={member} details={details} />
        ))}
      </View>
      <ThemedText variant="caption" muted style={styles.brand}>
        {t('share.madeWith')}
      </ThemedText>
    </View>
  );
}

function CardMember({
  member,
  details,
}: {
  member: Team['members'][number];
  details: TeamDetails;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { typeName } = useCatalog();
  const variety = details.pokemon.get(member.pokemonId);
  const accent = useTypeAccent(variety?.types[0]);
  const ability = variety?.abilities.find((a) => a.id === member.abilityId)?.name;
  const item = member.itemId === null ? null : details.items.get(member.itemId);
  return (
    <View
      style={[
        styles.member,
        { backgroundColor: theme.colors.background, borderLeftColor: accent.base },
      ]}
    >
      <View style={styles.memberHead}>
        <PokemonSprite
          pokemonId={member.pokemonId}
          style="official"
          shiny={member.shiny}
          size={48}
        />
        <View style={styles.flex}>
          <ThemedText variant="small" bold numberOfLines={1}>
            {member.nickname || variety?.name}
          </ThemedText>
          <View style={styles.types}>
            {variety?.types.map((type) => (
              <TypeBadge key={type} type={type} name={typeName(type)} size="sm" />
            ))}
          </View>
        </View>
      </View>
      {item ? (
        <ThemedText variant="caption" numberOfLines={1}>
          @ {item}
        </ThemedText>
      ) : null}
      {ability ? (
        <ThemedText variant="caption" muted numberOfLines={1}>
          {ability}
        </ThemedText>
      ) : null}
      {member.teraType ? (
        <ThemedText variant="caption" muted numberOfLines={1}>
          {t('teamEditor.teraShort', {
            type: member.teraType === 'stellar' ? t('slot.stellar') : typeName(member.teraType),
          })}
        </ThemedText>
      ) : null}
      {member.moveIds
        .filter((id): id is number => id !== null)
        .map((id) => (
          <ThemedText key={id} variant="caption" numberOfLines={1}>
            • {details.moves.get(id)?.name ?? '…'}
          </ThemedText>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: SPACING.md },
  text: {
    borderRadius: RADII.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.small,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  card: {
    borderRadius: RADII.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.lg,
    gap: SPACING.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  member: {
    width: '48.5%',
    borderRadius: RADII.md,
    borderLeftWidth: 4,
    padding: SPACING.sm,
    gap: 1,
  },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  types: { flexDirection: 'row', gap: 2, flexWrap: 'wrap' },
  brand: { textAlign: 'right', marginTop: SPACING.xs },
});
