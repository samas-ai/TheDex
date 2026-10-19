import { router, Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { assertGeneration } from '@thedex/engine';
import { getPokemon, type PokemonDetail } from '@thedex/db';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { PokemonPicker } from '../../entities/pokemon/PokemonPicker';
import { PokemonSprite } from '../../entities/pokemon/PokemonSprite';
import { TypeBadge } from '../../entities/pokemon/TypeBadge';
import { baseOf, engineStat, statsOf } from '../../entities/stats/stat-calc';
import { multiplierLabel } from '../../entities/type/type-matchups';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { formatHeight, formatWeight } from '../../shared/format';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useSettings } from '../../shared/settings/SettingsProvider';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Icon } from '../../shared/ui/Icon';
import { Button, Loading, Message, ThemedText } from '../../shared/ui/primitives';
import { bestIndices, MAX_COMPARED, weaknessesOf } from './compare-logic';

const LABEL = 84;
const COLUMN = 128;

/**
 * RF10.1: two or more Pokémon side by side, in the selected game — base stats (the best of
 * each row highlighted), typing, abilities, height/weight and weaknesses.
 */
export function ComparatorScreen({ initialIds }: { initialIds: readonly number[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx, game } = useGame();
  const { settings } = useSettings();
  const { typeName, statName } = useCatalog();
  const [ids, setIds] = useState<readonly number[]>(initialIds);
  const [picking, setPicking] = useState(false);
  const gen = assertGeneration(ctx.generationId);
  const loaded = useAsync(async () => {
    const list: PokemonDetail[] = [];
    for (const id of ids) {
      const detail = await getPokemon(db, id, ctx);
      if (detail) list.push(detail);
    }
    return list;
  }, [db, ctx, ids.join(',')]);

  const updateIds = (next: readonly number[]) => {
    setIds(next);
    router.setParams({ ids: next.join(',') });
  };

  const columns = loaded.data ?? [];
  const row = (label: string, cells: ReactNode[], key: string) => (
    <View key={key} style={[styles.row, { borderBottomColor: theme.colors.border }]}>
      <ThemedText variant="small" muted style={styles.label}>
        {label}
      </ThemedText>
      {cells.map((cell, index) => (
        <View key={index} style={styles.cell}>
          {cell}
        </View>
      ))}
    </View>
  );
  const numbers = (
    label: string,
    values: (number | null)[],
    key: string,
    format: (value: number) => string = String,
  ) => {
    const best = bestIndices(values);
    return row(
      label,
      values.map((value, index) => (
        <ThemedText
          bold={best.has(index)}
          color={best.has(index) ? theme.colors.primary : undefined}
          style={styles.centerText}
        >
          {value === null ? '—' : format(value)}
        </ThemedText>
      )),
      key,
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: t('nav.compare') }} />
      {!loaded.data ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {columns.length < 2 ? <Message text={t('compare.empty')} /> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {row(
                '',
                columns.map((pokemon) => (
                  <View style={styles.head}>
                    <Pressable
                      onPress={() => updateIds(ids.filter((id) => id !== pokemon.id))}
                      accessibilityRole="button"
                      accessibilityLabel={t('compare.remove', { name: pokemon.name })}
                      hitSlop={8}
                      style={styles.remove}
                    >
                      <Icon name="close" size={18} color={theme.colors.textMuted} />
                    </Pressable>
                    <Pressable
                      onPress={() => router.push(`/pokemon/${pokemon.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={pokemon.name}
                      style={styles.centerBox}
                    >
                      <PokemonSprite
                        pokemonId={pokemon.id}
                        style={settings.spriteStyle}
                        size={72}
                      />
                      <ThemedText bold numberOfLines={2} style={styles.centerText}>
                        {pokemon.name}
                      </ThemedText>
                    </Pressable>
                  </View>
                )),
                'head',
              )}
              {row(
                t('compare.types'),
                columns.map((pokemon) => (
                  <View style={styles.badges}>
                    {pokemon.types.map((type) => (
                      <TypeBadge key={type} type={type} name={typeName(type)} size="sm" />
                    ))}
                  </View>
                )),
                'types',
              )}
              {statsOf(gen).map((stat) =>
                numbers(
                  statName(engineStat(stat, gen)),
                  columns.map((pokemon) =>
                    pokemon.stats ? baseOf(pokemon.stats, stat, gen) : null,
                  ),
                  stat,
                ),
              )}
              {numbers(
                t('compare.total'),
                columns.map((pokemon) => pokemon.stats?.bst ?? null),
                'bst',
              )}
              {row(
                t('compare.abilities'),
                columns.map((pokemon) => (
                  <View>
                    {pokemon.abilities.map((ability) => (
                      <ThemedText key={ability.id} variant="small" style={styles.centerText}>
                        {ability.name}
                        {ability.isHidden ? ` ${t('compare.hidden')}` : ''}
                      </ThemedText>
                    ))}
                  </View>
                )),
                'abilities',
              )}
              {numbers(
                t('compare.height'),
                columns.map((pokemon) => pokemon.heightDm),
                'height',
                (dm) => t('units.meters', { value: formatHeight(dm).meters }),
              )}
              {numbers(
                t('compare.weight'),
                columns.map((pokemon) => pokemon.weightHg),
                'weight',
                (hg) => t('units.kilograms', { value: formatWeight(hg).kilograms }),
              )}
              {row(
                t('compare.weaknesses'),
                columns.map((pokemon) => {
                  const weak = weaknessesOf(pokemon.types, gen);
                  return weak.length === 0 ? (
                    <ThemedText muted style={styles.centerText}>
                      {t('compare.none')}
                    </ThemedText>
                  ) : (
                    <View style={styles.badges}>
                      {weak.map(({ type, multiplier }) => (
                        <View key={type} style={styles.weakness}>
                          <TypeBadge type={type} name={typeName(type)} size="sm" />
                          {multiplier > 2 ? (
                            <ThemedText variant="caption" bold color={theme.colors.danger}>
                              {multiplierLabel(multiplier)}
                            </ThemedText>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  );
                }),
                'weak',
              )}
            </View>
          </ScrollView>
          {ids.length < MAX_COMPARED ? (
            <View style={styles.add}>
              <Button label={t('compare.add')} onPress={() => setPicking(true)} />
            </View>
          ) : null}
          <ThemedText variant="caption" muted>
            {t('compare.hint', { game: game.name })}
          </ThemedText>
        </ScrollView>
      )}
      <PokemonPicker
        visible={picking}
        title={t('compare.add')}
        ctx={ctx}
        onSelect={(entry) => {
          setPicking(false);
          if (!ids.includes(entry.id)) updateIds([...ids, entry.id]);
        }}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { width: LABEL },
  cell: { width: COLUMN, alignItems: 'center', paddingHorizontal: SPACING.xs },
  head: { alignItems: 'center', width: '100%' },
  remove: { alignSelf: 'flex-end' },
  centerBox: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3 },
  weakness: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  add: { borderRadius: RADII.md },
});
