import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { teamDefense, teamOffense, type Generation } from '@thedex/engine';
import type { TeamMember } from '@thedex/db';
import { onColor, RADII, SPACING, typeAccent } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { PokemonSprite } from '../../entities/pokemon/PokemonSprite';
import { TypeBadge } from '../../entities/pokemon/TypeBadge';
import { multiplierColor } from '../../entities/type/MatchupGroups';
import { multiplierLabel } from '../../entities/type/type-matchups';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Icon } from '../../shared/ui/Icon';
import { Card, Message, Section, ThemedText } from '../../shared/ui/primitives';
import { coverageMembers } from './team-logic';
import type { TeamDetails } from './useTeamDetails';

const CELL = 34;
const TYPE_COLUMN = 64;

/**
 * RF08.3: defensive matrix of the whole team (each attacking type against each member, with
 * alerts when 3+ members are weak), and the offensive coverage of the chosen damaging moves.
 */
export function CoverageView({
  members,
  details,
  gen,
}: {
  members: readonly TeamMember[];
  details: TeamDetails;
  gen: Generation;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { typeName } = useCatalog();
  const entries = coverageMembers(members, details.pokemon, details.moves);
  if (entries.length === 0) return <Message text={t('coverage.empty')} />;

  const defense = teamDefense(
    entries.map((entry) => entry.coverage),
    gen,
  );
  const offense = teamOffense(
    entries.map((entry) => entry.coverage),
    gen,
  );
  const alerts = defense.filter((row) => row.severity !== null);
  const hasMoves = offense.some((row) => row.best !== null);
  const gaps = offense.filter((row) => row.best === null || row.best < 2);
  const short = (type: string) => typeName(type).slice(0, 3).toUpperCase();

  return (
    <View>
      <Section title={t('coverage.alerts')}>
        <Card>
          {alerts.length === 0 ? (
            <ThemedText muted>{t('coverage.noAlerts')}</ThemedText>
          ) : (
            alerts.map((row) => (
              <View key={row.attacking} style={styles.alert}>
                <Icon
                  name={row.severity === 'critical' ? 'alert-octagon' : 'alert'}
                  size={18}
                  color={row.severity === 'critical' ? theme.colors.danger : theme.colors.warning}
                />
                <ThemedText style={styles.flex}>
                  {t(row.severity === 'critical' ? 'coverage.critical' : 'coverage.warning', {
                    count: row.weak,
                    type: typeName(row.attacking),
                  })}
                </ThemedText>
              </View>
            ))
          )}
        </Card>
      </Section>

      <Section title={t('coverage.defense')}>
        <ThemedText variant="caption" muted>
          {t('coverage.defenseNote')}
        </ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.row}>
              <View style={{ width: TYPE_COLUMN }} />
              {entries.map(({ member }, index) => (
                <View key={index} style={styles.headCell}>
                  <PokemonSprite
                    pokemonId={member.pokemonId}
                    style="pixel"
                    shiny={member.shiny}
                    size={CELL}
                  />
                </View>
              ))}
              <ThemedText variant="caption" bold style={styles.count}>
                {t('coverage.weakShort')}
              </ThemedText>
              <ThemedText variant="caption" bold style={styles.count}>
                {t('coverage.resistShort')}
              </ThemedText>
            </View>
            {defense.map((row) => {
              const accent = typeAccent(row.attacking, theme);
              return (
                <View key={row.attacking} style={styles.row}>
                  <View style={[styles.typeCell, { backgroundColor: accent.base }]}>
                    <ThemedText variant="caption" bold color={accent.onBase}>
                      {short(row.attacking)}
                    </ThemedText>
                  </View>
                  {row.multipliers.map((multiplier, index) => {
                    const color =
                      multiplier === 1 ? theme.colors.surface : multiplierColor(multiplier);
                    return (
                      <View
                        key={index}
                        style={[
                          styles.cell,
                          { backgroundColor: color, borderColor: theme.colors.border },
                        ]}
                        accessibilityLabel={`${typeName(row.attacking)}: ${multiplierLabel(multiplier)}`}
                      >
                        <ThemedText variant="caption" bold color={onColor(color)}>
                          {multiplier === 1 ? '' : multiplierLabel(multiplier).slice(1)}
                        </ThemedText>
                      </View>
                    );
                  })}
                  <ThemedText
                    variant="small"
                    bold={row.severity !== null}
                    color={
                      row.severity === 'critical'
                        ? theme.colors.danger
                        : row.severity === 'warning'
                          ? theme.colors.warning
                          : undefined
                    }
                    style={styles.count}
                  >
                    {row.weak}
                  </ThemedText>
                  <ThemedText variant="small" style={styles.count}>
                    {row.resist + row.immune}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </Section>

      <Section title={t('coverage.offense')}>
        {!hasMoves ? (
          <ThemedText muted>{t('coverage.noMoves')}</ThemedText>
        ) : (
          <>
            <ThemedText variant="caption" muted>
              {t('coverage.offenseNote')}
            </ThemedText>
            <Card>
              <View style={styles.grid}>
                {offense.map((row) => {
                  const best = row.best ?? 0;
                  const color = multiplierColor(best);
                  return (
                    <View key={row.defending} style={styles.offenseItem}>
                      <TypeBadge type={row.defending} name={typeName(row.defending)} size="sm" />
                      <View style={[styles.offenseValue, { backgroundColor: color }]}>
                        <ThemedText variant="caption" bold color={onColor(color)}>
                          {row.best === null ? '—' : multiplierLabel(row.best)}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
              {gaps.length > 0 ? (
                <ThemedText variant="small" color={theme.colors.warning}>
                  {t('coverage.gaps', {
                    types: gaps.map((row) => typeName(row.defending)).join(', '),
                  })}
                </ThemedText>
              ) : (
                <ThemedText variant="small" color={theme.colors.success}>
                  {t('coverage.full')}
                </ThemedText>
              )}
            </Card>
          </>
        )}
      </Section>
      <ThemedText variant="caption" muted>
        {t('coverage.abilityNote')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 2 },
  headCell: { width: CELL, alignItems: 'center' },
  typeCell: {
    width: TYPE_COLUMN,
    height: CELL - 6,
    borderRadius: RADII.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    width: CELL,
    height: CELL - 6,
    borderRadius: RADII.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { width: 32, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  offenseItem: { flexDirection: 'row', alignItems: 'center', gap: 4, width: '47%' },
  offenseValue: { borderRadius: RADII.sm, paddingHorizontal: SPACING.xs, minWidth: 32 },
});
