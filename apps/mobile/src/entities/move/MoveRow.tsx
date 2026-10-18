import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { ThemedText } from '../../shared/ui/primitives';
import { useCatalog } from '../catalog/CatalogProvider';
import { TypeBadge } from '../pokemon/TypeBadge';
import { DamageClassBadge } from './DamageClassBadge';
import { formatMoveValue } from './move-format';

/** The data a move row shows (a Move Dex entry, a TM's move, a type's moves…). */
export interface MoveRowData {
  readonly id: number;
  readonly name: string;
  readonly type: string | null;
  readonly damageClass: string | null;
  readonly power: number | null;
  readonly accuracy: number | null;
  readonly pp: number | null;
}

/** A move in a list, tinted by its type (RNF03): type, category, power, accuracy and PP. */
export const MoveRow = memo(function MoveRow({
  move,
  onPress,
  lead,
  right,
}: {
  move: MoveRowData;
  onPress: (moveId: number) => void;
  /** Leading label (TM number, level…). */
  lead?: string | null;
  /** Trailing value (the sorted value, a badge…). */
  right?: ReactNode;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { typeName } = useCatalog();
  const accent = useTypeAccent(move.type);
  return (
    <Pressable
      onPress={() => onPress(move.id)}
      accessibilityRole="button"
      accessibilityLabel={move.name}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? accent.tint : theme.colors.surface,
          borderLeftColor: accent.base,
        },
      ]}
    >
      {lead ? (
        <ThemedText variant="caption" bold muted style={styles.lead}>
          {lead}
        </ThemedText>
      ) : null}
      <View style={styles.body}>
        <ThemedText bold numberOfLines={1}>
          {move.name}
        </ThemedText>
        <View style={styles.meta}>
          {move.type ? <TypeBadge type={move.type} name={typeName(move.type)} size="sm" /> : null}
          {move.damageClass ? <DamageClassBadge damageClass={move.damageClass} size="sm" /> : null}
          <ThemedText variant="caption" muted numberOfLines={1} style={styles.numbers}>
            {`${t('profile.moves.power')} ${formatMoveValue(move.power)} · ${t('profile.moves.accuracy')} ${formatMoveValue(move.accuracy)} · ${t('profile.moves.pp')} ${formatMoveValue(move.pp)}`}
          </ThemedText>
        </View>
      </View>
      {right}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADII.md,
    borderLeftWidth: 4,
  },
  lead: { minWidth: 44 },
  body: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  numbers: { flexShrink: 1, marginLeft: SPACING.xs },
});
