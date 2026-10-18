import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PokemonProfile } from '@thedex/db';
import { EFFECTIVENESS_COLORS, onColor, RADII, SPACING } from '@thedex/ui-tokens';
import { useCatalog } from '../../../entities/catalog/CatalogProvider';
import { TypeBadge } from '../../../entities/pokemon/TypeBadge';
import { useGame } from '../../../shared/game/GameProvider';
import { Card, Section, ThemedText } from '../../../shared/ui/primitives';
import { defensiveGroups, multiplierLabel } from '../profile-logic';

/**
 * RF02.3: weaknesses, resistances and immunities (4× … 0×) from @thedex/engine for the typing
 * and generation of the selected game (e.g. Steel resists Ghost/Dark only before Gen 6).
 */
export function MatchupsTab({ profile }: { profile: PokemonProfile }) {
  const { t } = useTranslation();
  const { ctx } = useGame();
  const { typeName } = useCatalog();
  const groups = defensiveGroups(profile.types, ctx.generationId);
  return (
    <View>
      <Section title={t('profile.matchups.title')}>
        <Card>
          {groups.map((group) => {
            const color =
              EFFECTIVENESS_COLORS[String(group.multiplier) as keyof typeof EFFECTIVENESS_COLORS];
            return (
              <View key={group.multiplier} style={styles.group}>
                <View style={[styles.multiplier, { backgroundColor: color }]}>
                  <ThemedText bold color={onColor(color)}>
                    {multiplierLabel(group.multiplier)}
                  </ThemedText>
                </View>
                <View style={styles.types}>
                  {group.types.map((type) => (
                    <TypeBadge key={type} type={type} name={typeName(type)} size="sm" />
                  ))}
                </View>
              </View>
            );
          })}
        </Card>
      </Section>
      <ThemedText variant="caption" muted>
        {t('profile.matchups.note', { number: ctx.generationId })}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  multiplier: { width: 48, alignItems: 'center', borderRadius: RADII.sm, paddingVertical: 2 },
  types: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
});
