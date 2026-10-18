import { useMemo, useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  listAbilities,
  listEggGroups,
  listGenerations,
  listRegions,
  listSpeciesTags,
  normalizeSearchText,
  type CaptureStatus,
} from '@thedex/db';
import { RADII, SPACING, typeAccent } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Sheet } from '../../shared/ui/Sheet';
import { Button, Chip, Section, styles as ui, ThemedText } from '../../shared/ui/primitives';
import { EMPTY_FILTERS, toggle, toggleType, type PokedexFilterState } from './pokedex-state';

const CAPTURE_STATUSES: readonly CaptureStatus[] = ['seen', 'caught', 'shiny', 'not-caught'];
const KNOWN_TAGS = [
  'starter',
  'legendary',
  'mythical',
  'ultra_beast',
  'paradox',
  'baby',
  'fossil',
] as const;
type KnownTag = (typeof KNOWN_TAGS)[number];
const isKnownTag = (tag: string): tag is KnownTag =>
  (KNOWN_TAGS as readonly string[]).includes(tag);
const MAX_ABILITY_RESULTS = 24;

/** RF01.3 filters. Changes apply immediately (every filter query is < 10 ms). */
export function FilterSheet({
  visible,
  filters,
  onChange,
  onClose,
}: {
  visible: boolean;
  filters: PokedexFilterState;
  onChange: (filters: PokedexFilterState) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const { types } = useCatalog();
  const [abilityQuery, setAbilityQuery] = useState('');

  const { data: options } = useAsync(async () => {
    if (!visible) return undefined;
    const [generations, regions, eggGroups, abilities, tags] = await Promise.all([
      listGenerations(db, ctx),
      listRegions(db, ctx),
      listEggGroups(db, ctx),
      listAbilities(db, ctx),
      listSpeciesTags(db),
    ]);
    return { generations, regions, eggGroups, abilities, tags };
  }, [db, ctx, visible]);

  const abilityMatches = useMemo(() => {
    const abilities = options?.abilities ?? [];
    const selected = abilities.find((a) => a.id === filters.abilityId);
    const query = normalizeSearchText(abilityQuery);
    const matches = abilities
      .filter((a) => a.id !== filters.abilityId)
      .filter((a) => query === '' || normalizeSearchText(a.name).includes(query))
      .slice(0, MAX_ABILITY_RESULTS);
    return selected ? [selected, ...matches] : matches;
  }, [options?.abilities, abilityQuery, filters.abilityId]);

  const set = (patch: Partial<PokedexFilterState>) => onChange({ ...filters, ...patch });
  const tags = (options?.tags ?? []).filter(isKnownTag);

  return (
    <Sheet
      visible={visible}
      title={t('pokedex.filters')}
      onClose={onClose}
      footer={
        <>
          <View style={styles.flex}>
            <Button
              label={t('common.reset')}
              onPress={() => onChange(EMPTY_FILTERS)}
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
      <Section title={t('pokedex.filter.types')}>
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
                onPress={() => set({ typeIds: toggleType(filters.typeIds, type.id) })}
              />
            );
          })}
        </View>
      </Section>

      {options ? (
        <>
          <Section title={t('pokedex.filter.generation')}>
            <View style={ui.wrap}>
              {options.generations.map((generation) => (
                <Chip
                  key={generation.id}
                  label={generation.name}
                  selected={filters.generationIds.includes(generation.id)}
                  onPress={() =>
                    set({ generationIds: toggle(filters.generationIds, generation.id) })
                  }
                />
              ))}
            </View>
          </Section>

          <Section title={t('pokedex.filter.region')}>
            <View style={ui.wrap}>
              {options.regions.map((region) => (
                <Chip
                  key={region.id}
                  label={region.name}
                  selected={filters.regionIds.includes(region.id)}
                  onPress={() => set({ regionIds: toggle(filters.regionIds, region.id) })}
                />
              ))}
            </View>
          </Section>

          {tags.length > 0 ? (
            <Section title={t('pokedex.filter.category')}>
              <View style={ui.wrap}>
                {tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={t(`pokedex.tags.${tag}`)}
                    selected={filters.tags.includes(tag)}
                    onPress={() => set({ tags: toggle(filters.tags, tag) })}
                  />
                ))}
              </View>
            </Section>
          ) : null}

          <Section title={t('pokedex.filter.capture')}>
            <View style={ui.wrap}>
              {CAPTURE_STATUSES.map((status) => (
                <Chip
                  key={status}
                  label={t(`pokedex.capture.${status}`)}
                  selected={filters.capture === status}
                  onPress={() => set({ capture: filters.capture === status ? null : status })}
                />
              ))}
            </View>
          </Section>

          {options.eggGroups.length > 0 ? (
            <Section title={t('pokedex.filter.eggGroup')}>
              <View style={ui.wrap}>
                {options.eggGroups.map((group) => (
                  <Chip
                    key={group.id}
                    label={group.name}
                    selected={filters.eggGroupId === group.id}
                    onPress={() =>
                      set({ eggGroupId: filters.eggGroupId === group.id ? null : group.id })
                    }
                  />
                ))}
              </View>
            </Section>
          ) : null}

          {options.abilities.length > 0 ? (
            <Section title={t('pokedex.filter.ability')}>
              <TextInput
                value={abilityQuery}
                onChangeText={setAbilityQuery}
                placeholder={t('pokedex.filter.abilitySearch')}
                placeholderTextColor={theme.colors.textMuted}
                autoCorrect={false}
                autoCapitalize="none"
                style={[
                  styles.input,
                  { backgroundColor: theme.colors.surfaceVariant, color: theme.colors.text },
                ]}
              />
              <View style={ui.wrap}>
                {abilityMatches.map((ability) => (
                  <Chip
                    key={ability.id}
                    label={ability.name}
                    selected={filters.abilityId === ability.id}
                    onPress={() =>
                      set({ abilityId: filters.abilityId === ability.id ? null : ability.id })
                    }
                  />
                ))}
              </View>
            </Section>
          ) : null}
        </>
      ) : null}

      <View style={styles.switchRow}>
        <ThemedText style={styles.flex}>{t('pokedex.filter.includeForms')}</ThemedText>
        <Switch
          value={filters.includeForms}
          onValueChange={(includeForms) => set({ includeForms })}
          trackColor={{ true: theme.colors.primary, false: theme.colors.surfaceVariant }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  input: {
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
});
