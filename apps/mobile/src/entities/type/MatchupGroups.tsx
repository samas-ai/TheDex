import { StyleSheet, View } from 'react-native';
import { EFFECTIVENESS_COLORS, onColor, RADII, SPACING, type HexColor } from '@thedex/ui-tokens';
import { ThemedText } from '../../shared/ui/primitives';
import { useCatalog } from '../catalog/CatalogProvider';
import { TypeBadge } from '../pokemon/TypeBadge';
import { multiplierLabel, type MatchupGroup } from './type-matchups';

const colorOf = (multiplier: number): HexColor =>
  EFFECTIVENESS_COLORS[String(multiplier) as keyof typeof EFFECTIVENESS_COLORS];

/** Types grouped by damage multiplier (×4 … ×0), each group led by a colored label. */
export function MatchupGroups({ groups }: { groups: readonly MatchupGroup[] }) {
  const { typeName } = useCatalog();
  return (
    <View>
      {groups.map((group) => {
        const color = colorOf(group.multiplier);
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
    </View>
  );
}

/** Background color of a chart cell (single-type multiplier). */
export function multiplierColor(multiplier: number): HexColor {
  return colorOf(multiplier);
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
