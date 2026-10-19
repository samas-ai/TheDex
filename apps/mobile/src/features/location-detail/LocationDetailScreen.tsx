import { FlashList } from '@shopify/flash-list';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  getLocation,
  getLocationEncounters,
  type AreaEncounter,
  type LocationDetail,
} from '@thedex/db';
import { SPACING } from '@thedex/ui-tokens';
import { LOCATION_KIND_ICONS } from '../../entities/location/location-icons';
import { PokemonRow } from '../../entities/pokemon/PokemonRow';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import type { SectionRow } from '../../shared/sections';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Icon } from '../../shared/ui/Icon';
import { Button, Loading, Message, ThemedText } from '../../shared/ui/primitives';

type EncounterRow = SectionRow<string, AreaEncounter>;

/** RF06.2: a location's wild Pokémon per area — method, time/season, levels and rate. */
export function LocationDetailScreen({ locationId }: { locationId: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx, features, game } = useGame();
  const detail = useAsync(() => getLocation(db, locationId, ctx), [db, ctx, locationId]);
  const encounters = useAsync(
    () => getLocationEncounters(db, locationId, ctx),
    [db, ctx, locationId],
  );
  const location = detail.data && detail.data.id === locationId ? detail.data : null;

  const rows = useMemo((): EncounterRow[] => {
    const areas = encounters.data ?? [];
    return areas.flatMap((area): EncounterRow[] => [
      // A location with a single area needs no header.
      ...(areas.length > 1
        ? [
            {
              type: 'header' as const,
              key: `area:${area.areaId}`,
              header: area.areaName ?? location?.name ?? '',
            },
          ]
        : []),
      ...area.encounters.map((encounter, index) => ({
        type: 'item' as const,
        key: `${area.areaId}:${index}`,
        item: encounter,
      })),
    ]);
  }, [encounters.data, location?.name]);

  if (detail.error) {
    return (
      <Message
        text={t('common.error', { message: detail.error.message })}
        action={<Button label={t('common.retry')} onPress={detail.reload} />}
      />
    );
  }
  if (!location) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: '' }} />
        {detail.loading ? <Loading /> : <Message text={t('location.notFound')} />}
      </View>
    );
  }

  const empty = encounters.data !== undefined && encounters.data.length === 0;
  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: location.name }} />
      <FlashList
        data={rows}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.type}
        ListHeaderComponent={
          <LocationHeader
            location={location}
            note={
              !encounters.data
                ? null
                : empty
                  ? features.hasEncounters
                    ? t('location.none')
                    : t('location.dataGap')
                  : null
            }
            gameName={game.name}
            loading={!encounters.data}
          />
        }
        renderItem={({ item: row }) =>
          row.type === 'header' ? (
            <ThemedText variant="caption" bold muted style={styles.sectionHeader}>
              {row.header}
            </ThemedText>
          ) : (
            <View style={styles.rowWrap}>
              <EncounterItem encounter={row.item} />
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

function LocationHeader({
  location,
  note,
  gameName,
  loading,
}: {
  location: LocationDetail;
  note: string | null;
  gameName: string;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Icon name={LOCATION_KIND_ICONS[location.kind]} size={28} color={theme.colors.primary} />
        <View style={styles.flex}>
          <ThemedText variant="headline">{location.name}</ThemedText>
          <ThemedText muted>
            {[location.region?.name, t(`locationDex.kinds.${location.kind}`)]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
          {location.subtitle ? (
            <ThemedText variant="caption" muted>
              {location.subtitle}
            </ThemedText>
          ) : null}
        </View>
      </View>
      {!location.inGame ? (
        <ThemedText variant="caption" muted>
          {t('location.notInGame', { game: gameName })}
        </ThemedText>
      ) : null}
      <ThemedText variant="title" bold style={styles.title}>
        {t('location.encounters')}
      </ThemedText>
      {loading ? <Loading /> : null}
      {note ? <ThemedText muted>{note}</ThemedText> : null}
    </View>
  );
}

function EncounterItem({ encounter }: { encounter: AreaEncounter }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const levels =
    encounter.minLevel === encounter.maxLevel
      ? t('profile.locations.level', { level: encounter.minLevel })
      : t('profile.locations.levels', { min: encounter.minLevel, max: encounter.maxLevel });
  return (
    <PokemonRow
      pokemonId={encounter.pokemon.id}
      speciesId={encounter.pokemon.speciesId}
      name={encounter.pokemon.name}
      types={encounter.pokemon.types}
      detail={
        <View>
          <ThemedText variant="caption">{encounter.method.name}</ThemedText>
          {encounter.conditions.length > 0 ? (
            <ThemedText variant="caption" color={theme.colors.primary}>
              {encounter.conditions.map((condition) => condition.name).join(' · ')}
            </ThemedText>
          ) : null}
          <ThemedText variant="caption" muted>
            {encounter.versions.map((version) => version.name).join(', ')}
          </ThemedText>
        </View>
      }
      right={
        <View style={styles.numbers}>
          <ThemedText variant="small" bold>
            {levels}
          </ThemedText>
          {encounter.ratePct !== null ? (
            <ThemedText variant="small" color={theme.colors.primary}>
              {t('profile.locations.rate', { rate: encounter.ratePct })}
            </ThemedText>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: { padding: SPACING.lg, gap: SPACING.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  title: { marginTop: SPACING.md },
  sectionHeader: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  rowWrap: { paddingHorizontal: SPACING.lg },
  numbers: { alignItems: 'flex-end', gap: 2 },
  listContent: { paddingBottom: SPACING.xxl },
});
