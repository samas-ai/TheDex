import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { DAMAGE_CLASSES, listGenerations } from '@thedex/db';
import { DAMAGE_CLASS_COLORS, onColor, SPACING, typeAccent } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Sheet } from '../../shared/ui/Sheet';
import { Button, Chip, Section, styles as ui, ThemedText } from '../../shared/ui/primitives';
import { toggle } from '../../shared/toggle';
import {
  defaultMoveFilters,
  toggleDamageClass,
  toggleMoveType,
  type MoveFilterState,
} from './move-dex-state';

/** RF03.1 filters: type, category, generation and "learnable in this game". */
export function MoveFilterSheet({
  visible,
  filters,
  onChange,
  onClose,
}: {
  visible: boolean;
  filters: MoveFilterState;
  onChange: (filters: MoveFilterState) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx, features } = useGame();
  const { types, damageClassName } = useCatalog();
  const { data: generations } = useAsync(
    async () => (visible ? listGenerations(db, ctx) : undefined),
    [db, ctx, visible],
  );
  const set = (patch: Partial<MoveFilterState>) => onChange({ ...filters, ...patch });

  return (
    <Sheet
      visible={visible}
      title={t('common.filters')}
      onClose={onClose}
      footer={
        <>
          <View style={styles.flex}>
            <Button
              label={t('common.reset')}
              onPress={() => onChange(defaultMoveFilters(features.hasLearnsets))}
              color={theme.colors.surfaceVariant}
              textColor={theme.colors.text}
            />
          </View>
          <View style={styles.flex}>
            <Button label={t('common.done')} onPress={onClose} />
          </View>
        </>
      }
    >
      {features.hasLearnsets ? (
        <View style={styles.switchRow}>
          <ThemedText style={styles.flex}>{t('moveDex.learnableOnly')}</ThemedText>
          <Switch
            value={filters.learnableOnly}
            onValueChange={(learnableOnly) => set({ learnableOnly })}
            trackColor={{ true: theme.colors.primary }}
          />
        </View>
      ) : null}

      <Section title={t('moveDex.filter.types')}>
        <View style={ui.wrap}>
          {types.map((type) => {
            const accent = typeAccent(type.identifier, theme);
            return (
              <Chip
                key={type.id}
                label={type.name}
                selected={filters.typeIds.includes(type.id)}
                selectedColor={accent.base}
                selectedTextColor={accent.onBase}
                onPress={() => set({ typeIds: toggleMoveType(filters.typeIds, type.id) })}
              />
            );
          })}
        </View>
      </Section>

      <Section title={t('moveDex.filter.category')}>
        <View style={ui.wrap}>
          {DAMAGE_CLASSES.map((damageClass) => {
            const color = DAMAGE_CLASS_COLORS[damageClass];
            return (
              <Chip
                key={damageClass}
                label={damageClassName(damageClass)}
                selected={filters.damageClasses.includes(damageClass)}
                selectedColor={color}
                selectedTextColor={onColor(color)}
                onPress={() =>
                  set({ damageClasses: toggleDamageClass(filters.damageClasses, damageClass) })
                }
              />
            );
          })}
        </View>
      </Section>

      {generations ? (
        <Section title={t('moveDex.filter.generation')}>
          <View style={ui.wrap}>
            {generations.map((generation) => (
              <Chip
                key={generation.id}
                label={generation.name}
                selected={filters.generationIds.includes(generation.id)}
                onPress={() => set({ generationIds: toggle(filters.generationIds, generation.id) })}
              />
            ))}
          </View>
        </Section>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
});
