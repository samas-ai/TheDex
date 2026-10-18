import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FONT_WEIGHTS, onColor, typeAccent } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { multiplierColor } from '../../entities/type/MatchupGroups';
import { typeChart } from '../../entities/type/type-matchups';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { ThemedText } from '../../shared/ui/primitives';

const CELL = 28;
const HEADER = 56;

/** Cell text: neutral cells stay blank so the effective ones stand out. */
function cellLabel(multiplier: number): string {
  if (multiplier === 1) return '';
  if (multiplier === 0.5) return '½';
  return String(multiplier);
}

/** RF07.1: the generation's full type chart (rows attack, columns defend). */
export function TypeChart({
  generationId,
  highlight,
}: {
  generationId: number;
  /** Selected types: their row and column are emphasized. */
  highlight: readonly string[];
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { typeName } = useCatalog();
  const chart = typeChart(generationId);
  const short = (type: string) => typeName(type).slice(0, 3).toUpperCase();
  return (
    <View>
      <ThemedText variant="caption" muted style={styles.note}>
        {t('typeDex.chartNote', { number: generationId })}
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.row}>
            <View style={{ width: HEADER }} />
            {chart.types.map((type) => {
              const accent = typeAccent(type, theme);
              return (
                <View key={type} style={[styles.headerCell, { backgroundColor: accent.base }]}>
                  <ThemedText style={[styles.tiny, { color: accent.onBase }]}>
                    {short(type)}
                  </ThemedText>
                </View>
              );
            })}
          </View>
          {chart.types.map((attacking, row) => {
            const accent = typeAccent(attacking, theme);
            const rowHighlighted = highlight.includes(attacking);
            return (
              <View key={attacking} style={styles.row}>
                <View style={[styles.rowHeader, { backgroundColor: accent.base }]}>
                  <ThemedText style={[styles.tiny, { color: accent.onBase }]} numberOfLines={1}>
                    {typeName(attacking)}
                  </ThemedText>
                </View>
                {chart.types.map((defending, column) => {
                  const multiplier = chart.cells[row]![column]!;
                  const color =
                    multiplier === 1 ? theme.colors.surface : multiplierColor(multiplier);
                  const emphasized = rowHighlighted || highlight.includes(defending);
                  return (
                    <View
                      key={defending}
                      style={[
                        styles.cell,
                        {
                          backgroundColor: color,
                          borderColor: emphasized ? theme.colors.text : theme.colors.border,
                          borderWidth: emphasized ? 1 : StyleSheet.hairlineWidth,
                        },
                      ]}
                      accessibilityLabel={`${typeName(attacking)} → ${typeName(defending)}: ×${multiplier}`}
                    >
                      <ThemedText style={[styles.tiny, styles.bold, { color: onColor(color) }]}>
                        {cellLabel(multiplier)}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { marginBottom: 8 },
  row: { flexDirection: 'row' },
  headerCell: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
  rowHeader: { width: HEADER, height: CELL, justifyContent: 'center', paddingHorizontal: 4 },
  cell: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
  tiny: { fontSize: 10 },
  bold: { fontWeight: FONT_WEIGHTS.bold },
});
