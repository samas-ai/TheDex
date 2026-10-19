import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  listLocationRegions,
  listLocations,
  LOCATION_KINDS,
  type LocationListEntry,
} from '@thedex/db';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { LOCATION_KIND_ICONS } from '../../entities/location/location-icons';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useEntitySearch } from '../../shared/hooks/useEntitySearch';
import { applySearch } from '../../shared/search-filter';
import { toSectionRows } from '../../shared/sections';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Icon } from '../../shared/ui/Icon';
import { ListToolbar } from '../../shared/ui/ListToolbar';
import { Button, Chip, Loading, Message, ThemedText } from '../../shared/ui/primitives';

/** RF06.1: cities, routes, caves and special areas by region, Kanto to Paldea. */
export function LocationDexScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  // The game's regions come first, so the selected chip is never scrolled out of view.
  const regions = useAsync(() => listLocationRegions(db, ctx), [db, ctx]);
  const [regionId, setRegionId] = useState<number | null>(null);
  const [inGameOnly, setInGameOnly] = useState(true);
  const [query, setQuery] = useState('');

  // Start on the selected game's region (its first one for Johto + Kanto games).
  useEffect(() => {
    const list = regions.data ?? [];
    setRegionId((list.find((region) => region.inGame) ?? list[0])?.id ?? null);
  }, [regions.data]);

  const region = regions.data?.find((entry) => entry.id === regionId) ?? null;
  const gameRegion = region?.inGame ?? false;
  const locations = useAsync(
    async () =>
      regionId === null
        ? []
        : listLocations(db, ctx, { regionId, inGameOnly: gameRegion && inGameOnly }),
    [db, ctx, regionId, gameRegion, inGameOnly],
  );
  const hits = useEntitySearch('location', query);
  const visible = useMemo(() => applySearch(locations.data ?? [], hits), [locations.data, hits]);
  const rows = useMemo(
    () =>
      toSectionRows(
        visible,
        LOCATION_KINDS,
        (entry) => entry.kind,
        (entry) => String(entry.id),
      ),
    [visible],
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: t('nav.locations') }} />
      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder={t('locationDex.searchPlaceholder')}
        count={t('locationDex.count', { count: visible.length })}
      >
        {gameRegion ? (
          <Chip
            label={t('common.inThisGame')}
            selected={inGameOnly}
            onPress={() => setInGameOnly((value) => !value)}
          />
        ) : null}
      </ListToolbar>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.regions}
        >
          {(regions.data ?? []).map((entry) => (
            <Chip
              key={entry.id}
              label={entry.inGame ? `${entry.name} ★` : entry.name}
              selected={entry.id === regionId}
              onPress={() => setRegionId(entry.id)}
            />
          ))}
        </ScrollView>
      </View>
      {locations.error ? (
        <Message
          text={t('common.error', { message: locations.error.message })}
          action={<Button label={t('common.retry')} onPress={locations.reload} />}
        />
      ) : !locations.data ? (
        <Loading />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(row) => row.key}
          getItemType={(row) => row.type}
          renderItem={({ item: row }) =>
            row.type === 'header' ? (
              <ThemedText variant="caption" bold muted style={styles.sectionHeader}>
                {t(`locationDex.kinds.${row.header}`)}
              </ThemedText>
            ) : (
              <LocationRow location={row.item} />
            )
          }
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Message text={t('locationDex.empty')} />}
        />
      )}
    </View>
  );
}

const LocationRow = memo(function LocationRow({ location }: { location: LocationListEntry }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/location/${location.id}`)}
      accessibilityRole="button"
      accessibilityLabel={location.name}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.surface,
          opacity: location.inGame ? 1 : 0.6,
        },
      ]}
    >
      <Icon name={LOCATION_KIND_ICONS[location.kind]} size={22} color={theme.colors.textMuted} />
      <ThemedText style={styles.name} numberOfLines={1}>
        {location.name}
      </ThemedText>
      {location.hasEncounters ? (
        <View style={styles.encounters} accessibilityLabel={t('locationDex.encounters')}>
          <Icon name="grass" size={16} color={theme.colors.success} />
        </View>
      ) : null}
      <Icon name="chevron-right" size={20} color={theme.colors.textMuted} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  regions: { paddingHorizontal: SPACING.lg },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xxl,
  },
  sectionHeader: { marginTop: SPACING.sm, marginBottom: SPACING.xs, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xs,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: RADII.md,
  },
  name: { flex: 1 },
  encounters: { paddingHorizontal: SPACING.xs },
});
