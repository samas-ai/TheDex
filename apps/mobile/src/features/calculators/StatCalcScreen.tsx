import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  assertGeneration,
  hpDv,
  maxIv,
  showdownEvLimits,
  type NatureName,
  type ShowdownStat,
  type StatsTable,
} from '@thedex/engine';
import { getPokemon, listNatures } from '@thedex/db';
import { SPACING } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { PokemonPicker } from '../../entities/pokemon/PokemonPicker';
import { PokemonSprite } from '../../entities/pokemon/PokemonSprite';
import { TypeBadge } from '../../entities/pokemon/TypeBadge';
import { evTotal, setEv } from '../../entities/stats/evs';
import {
  baseOf,
  engineStat,
  formatIvRange,
  ivCandidates,
  natureEffect,
  statsOf,
  statValue,
} from '../../entities/stats/stat-calc';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { Icon } from '../../shared/ui/Icon';
import { NumberField } from '../../shared/ui/NumberField';
import { PickerModal } from '../../shared/ui/PickerModal';
import { Button, Card, Chip, Loading, Section, ThemedText } from '../../shared/ui/primitives';

const all = (value: number): StatsTable => ({
  hp: value,
  atk: value,
  def: value,
  spa: value,
  spd: value,
  spe: value,
});

const capStats = (table: StatsTable, max: number): StatsTable => ({
  hp: Math.min(table.hp, max),
  atk: Math.min(table.atk, max),
  def: Math.min(table.def, max),
  spa: Math.min(table.spa, max),
  spd: Math.min(table.spd, max),
  spe: Math.min(table.spe, max),
});

type Mode = 'stats' | 'reverse';

/**
 * RF11.1: exact stats at any level from IVs, EVs and nature, or the reverse — the IVs that fit
 * the stats shown in the game — with the generation's formulas (DVs and Stat Exp in Gen 1–2).
 */
export function StatCalcScreen({ initialPokemonId }: { initialPokemonId: number | null }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const { typeName, statName } = useCatalog();
  const gen = assertGeneration(ctx.generationId);
  const [pokemonId, setPokemonId] = useState(initialPokemonId);
  const [mode, setMode] = useState<Mode>('stats');
  const [level, setLevel] = useState(50);
  const [nature, setNature] = useState<NatureName | null>(null);
  const [rawIvs, setIvs] = useState<StatsTable>(() => all(maxIv(gen)));
  const [rawEvs, setEvs] = useState<StatsTable>(() => all(0));
  const [observed, setObserved] = useState<Partial<StatsTable>>({});
  const [picker, setPicker] = useState<'pokemon' | 'nature' | null>(null);
  const pokemon = useAsync(
    async () => (pokemonId ? getPokemon(db, pokemonId, ctx) : null),
    [db, ctx, pokemonId],
  );
  const natures = useAsync(() => listNatures(db, ctx), [db, ctx]);
  const accent = useTypeAccent(pokemon.data?.types[0]);
  const limits = showdownEvLimits(gen);
  // Values typed for another game stay within this generation's ranges.
  const ivs = capStats(rawIvs, maxIv(gen));
  const evs = capStats(rawEvs, limits.perStat);
  const stats = pokemon.data?.stats ?? null;
  const natureEntry = natures.data?.find((n) => n.identifier === nature);
  // Gen 1–2: the HP DV is derived from the other DVs.
  const gameIvs: StatsTable =
    gen <= 2
      ? {
          ...ivs,
          hp: hpDv({ attack: ivs.atk, defense: ivs.def, speed: ivs.spe, special: ivs.spa }),
          spd: ivs.spa,
        }
      : ivs;
  const total = evTotal(gen === 1 ? { ...evs, spd: 0 } : evs);

  const setEvValue = (stat: ShowdownStat, value: number) => {
    let next = setEv(evs, stat, value, gen);
    if (gen === 1 && stat === 'spa') next = { ...next, spd: next.spa };
    setEvs(next);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: t('nav.statCalc') }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => setPicker('pokemon')}
          accessibilityRole="button"
          accessibilityLabel={pokemon.data?.name ?? t('statCalc.pick')}
        >
          <Card style={styles.head}>
            {pokemonId ? <PokemonSprite pokemonId={pokemonId} style="pixel" size={56} /> : null}
            <View style={styles.flex}>
              <ThemedText variant="title" bold color={pokemonId ? undefined : accent.text}>
                {pokemon.data?.name ?? t('statCalc.pick')}
              </ThemedText>
              <View style={styles.wrap}>
                {pokemon.data?.types.map((type) => (
                  <TypeBadge key={type} type={type} name={typeName(type)} size="sm" />
                ))}
              </View>
            </View>
            <Icon name="chevron-right" color={theme.colors.textMuted} />
          </Card>
        </Pressable>

        {pokemonId === null ? null : !pokemon.data ? (
          <Loading />
        ) : (
          <>
            <View style={styles.wrap}>
              {(['stats', 'reverse'] as const).map((key) => (
                <Chip
                  key={key}
                  label={t(`statCalc.modes.${key}`)}
                  selected={mode === key}
                  onPress={() => setMode(key)}
                />
              ))}
            </View>
            <Card>
              <View style={styles.line}>
                <ThemedText muted style={styles.flex}>
                  {t('statCalc.level')}
                </ThemedText>
                <NumberField
                  value={level}
                  min={1}
                  max={100}
                  onChange={setLevel}
                  accessibilityLabel={t('statCalc.level')}
                />
              </View>
              {gen >= 3 ? (
                <Pressable
                  onPress={() => setPicker('nature')}
                  accessibilityRole="button"
                  style={styles.line}
                >
                  <ThemedText muted style={styles.flex}>
                    {t('statCalc.nature')}
                  </ThemedText>
                  <ThemedText bold color={accent.text}>
                    {natureEntry?.name ?? t('slot.neutral')}
                  </ThemedText>
                </Pressable>
              ) : null}
            </Card>

            <Section title={t(`statCalc.modes.${mode}`)}>
              <Card>
                <View style={styles.statRow}>
                  <View style={styles.statLabel} />
                  <ThemedText variant="caption" muted style={styles.statBase}>
                    {t('slot.base')}
                  </ThemedText>
                  {mode === 'stats' ? (
                    <ThemedText variant="caption" muted style={styles.statField}>
                      {gen <= 2 ? 'DV' : 'IV'}
                    </ThemedText>
                  ) : null}
                  <ThemedText variant="caption" muted style={styles.statField}>
                    EV
                  </ThemedText>
                  {mode === 'reverse' ? (
                    <ThemedText variant="caption" muted style={styles.statField}>
                      {t('statCalc.observed')}
                    </ThemedText>
                  ) : null}
                  <ThemedText variant="caption" muted style={styles.statResult}>
                    {mode === 'stats' ? t('statCalc.stat') : gen <= 2 ? 'DV' : t('statCalc.ivs')}
                  </ThemedText>
                </View>
                {statsOf(gen).map((stat) => {
                  const base = stats ? baseOf(stats, stat, gen) : null;
                  const effect = natureEffect(nature, stat, gen);
                  const value =
                    base === null
                      ? null
                      : statValue({
                          gen,
                          stat,
                          base,
                          level,
                          iv: gameIvs[stat],
                          ev: evs[stat],
                          nature,
                        });
                  const target = observed[stat];
                  const candidates =
                    base === null || target === undefined
                      ? null
                      : formatIvRange(
                          ivCandidates({
                            gen,
                            stat,
                            base,
                            level,
                            ev: evs[stat],
                            nature,
                            value: target,
                          }),
                        );
                  return (
                    <View key={stat} style={styles.statRow}>
                      <ThemedText
                        variant="small"
                        numberOfLines={1}
                        style={styles.statLabel}
                        color={
                          effect > 1
                            ? theme.colors.success
                            : effect < 1
                              ? theme.colors.danger
                              : undefined
                        }
                      >
                        {statName(engineStat(stat, gen))}
                        {effect > 1 ? ' ↑' : effect < 1 ? ' ↓' : ''}
                      </ThemedText>
                      <ThemedText variant="small" style={styles.statBase}>
                        {base ?? '—'}
                      </ThemedText>
                      {mode === 'stats' ? (
                        <View style={styles.statField}>
                          <NumberField
                            value={gameIvs[stat]}
                            min={0}
                            max={maxIv(gen)}
                            editable={!(gen <= 2 && stat === 'hp')}
                            onChange={(iv) =>
                              setIvs({
                                ...ivs,
                                [stat]: iv,
                                ...(gen <= 2 && stat === 'spa' ? { spd: iv } : {}),
                              })
                            }
                            accessibilityLabel={`${stat} IV`}
                            width={48}
                          />
                        </View>
                      ) : null}
                      <View style={styles.statField}>
                        <NumberField
                          value={evs[stat]}
                          min={0}
                          max={limits.perStat}
                          onChange={(ev) => setEvValue(stat, ev)}
                          accessibilityLabel={`${stat} EV`}
                          width={56}
                        />
                      </View>
                      {mode === 'reverse' ? (
                        <View style={styles.statField}>
                          <NumberField
                            value={target ?? 0}
                            min={0}
                            max={999}
                            onChange={(observedValue) =>
                              setObserved({ ...observed, [stat]: observedValue })
                            }
                            accessibilityLabel={`${stat} ${t('statCalc.observed')}`}
                            width={56}
                          />
                        </View>
                      ) : null}
                      <ThemedText
                        bold
                        style={styles.statResult}
                        color={
                          mode === 'reverse' && target !== undefined && candidates === null
                            ? theme.colors.danger
                            : accent.text
                        }
                      >
                        {mode === 'stats'
                          ? (value ?? '—')
                          : target === undefined
                            ? '—'
                            : (candidates ?? t('statCalc.noFit'))}
                      </ThemedText>
                    </View>
                  );
                })}
                <ThemedText variant="caption" muted>
                  {limits.total === null
                    ? t('slot.evsNoTotal')
                    : t('slot.evTotal', { total, max: limits.total, left: limits.total - total })}
                </ThemedText>
              </Card>
            </Section>
            <View style={styles.actions}>
              {mode === 'stats' ? (
                <View style={styles.flex}>
                  <Button
                    label={t('statCalc.maxIvs')}
                    color={theme.colors.surfaceVariant}
                    textColor={theme.colors.text}
                    onPress={() => setIvs(all(maxIv(gen)))}
                  />
                </View>
              ) : null}
              <View style={styles.flex}>
                <Button
                  label={t('statCalc.clearEvs')}
                  color={theme.colors.surfaceVariant}
                  textColor={theme.colors.text}
                  onPress={() => setEvs(all(0))}
                />
              </View>
            </View>
            {mode === 'reverse' ? (
              <ThemedText variant="caption" muted>
                {t('statCalc.reverseHint')}
              </ThemedText>
            ) : null}
            {gen <= 2 ? (
              <ThemedText variant="caption" muted>
                {t('statCalc.gen12Note')}
              </ThemedText>
            ) : null}
          </>
        )}
      </ScrollView>
      <PokemonPicker
        visible={picker === 'pokemon'}
        title={t('statCalc.pick')}
        ctx={ctx}
        onSelect={(entry) => {
          setPicker(null);
          setPokemonId(entry.id);
          setObserved({});
        }}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'nature'}
        title={t('statCalc.nature')}
        items={(natures.data ?? []).map((n) => ({
          key: n.identifier,
          title: n.name,
          subtitle: n.increased
            ? `+${n.increased.name} −${n.decreased?.name ?? ''}`
            : t('slot.neutral'),
          keywords: n.identifier,
        }))}
        selected={nature}
        allowNone
        onSelect={(key) => {
          setNature(key as NatureName | null);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 36 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, minHeight: 36 },
  statLabel: { flex: 1 },
  statBase: { width: 36, textAlign: 'right' },
  statField: { width: 60, alignItems: 'center' },
  statResult: { width: 56, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: SPACING.md },
});
