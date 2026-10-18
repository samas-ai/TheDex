import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getPokemonEncounters, type EncounterEntry, type PokemonProfile } from '@thedex/db';
import { SPACING, type TypeAccent } from '@thedex/ui-tokens';
import { useAppDatabase } from '../../../shared/db/DatabaseProvider';
import { useGame } from '../../../shared/game/GameProvider';
import { useAsync } from '../../../shared/hooks/useAsync';
import { useTheme } from '../../../shared/theme/ThemeProvider';
import { Icon } from '../../../shared/ui/Icon';
import { Card, Loading, Section, ThemedText } from '../../../shared/ui/primitives';

/** RF02.7: wild encounters per location in the selected game's versions. */
export function LocationsTab({ profile, accent }: { profile: PokemonProfile; accent: TypeAccent }) {
  const { t } = useTranslation();
  const { db } = useAppDatabase();
  const { ctx, features } = useGame();
  const theme = useTheme();
  const { data } = useAsync(() => getPokemonEncounters(db, profile.id, ctx), [db, ctx, profile.id]);
  if (!data) return <Loading />;
  if (data.length === 0) {
    // "None" only when PokeAPI has the game's encounters (SV, BDSP, Legends… do not yet).
    return (
      <ThemedText muted>
        {features.hasEncounters ? t('profile.locations.none') : t('profile.locations.dataGap')}
      </ThemedText>
    );
  }
  const byLocation = new Map<number, EncounterEntry[]>();
  for (const entry of data) {
    byLocation.set(entry.location.id, [...(byLocation.get(entry.location.id) ?? []), entry]);
  }
  return (
    <View>
      {[...byLocation.values()].map((entries) => (
        <Section
          key={entries[0]!.location.id}
          title={entries[0]!.location.name}
          right={
            <Pressable
              onPress={() => router.push(`/location/${entries[0]!.location.id}`)}
              accessibilityRole="button"
              accessibilityLabel={entries[0]!.location.name}
              hitSlop={8}
            >
              <Icon name="map-marker-radius" size={20} color={theme.colors.textMuted} />
            </Pressable>
          }
        >
          <Card>
            {entries.map((entry, index) => (
              <EncounterRow key={index} entry={entry} accent={accent} />
            ))}
          </Card>
        </Section>
      ))}
    </View>
  );
}

function EncounterRow({ entry, accent }: { entry: EncounterEntry; accent: TypeAccent }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const levels =
    entry.minLevel === entry.maxLevel
      ? t('profile.locations.level', { level: entry.minLevel })
      : t('profile.locations.levels', { min: entry.minLevel, max: entry.maxLevel });
  const showArea = entry.areaName !== null && entry.areaName !== entry.location.name;
  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
      <View style={styles.flex}>
        {showArea ? (
          <ThemedText variant="small" bold>
            {entry.areaName}
          </ThemedText>
        ) : null}
        <ThemedText variant="small">{entry.method.name}</ThemedText>
        {entry.conditions.length > 0 ? (
          <ThemedText variant="caption" color={accent.text}>
            {entry.conditions.map((condition) => condition.name).join(' · ')}
          </ThemedText>
        ) : null}
        <ThemedText variant="caption" muted>
          {entry.versions.map((version) => version.name).join(', ')}
        </ThemedText>
      </View>
      <View style={styles.numbers}>
        <ThemedText variant="small" bold>
          {levels}
        </ThemedText>
        {entry.ratePct !== null ? (
          <ThemedText variant="small" color={accent.text}>
            {t('profile.locations.rate', { rate: entry.ratePct })}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  numbers: { alignItems: 'flex-end', gap: 2 },
});
