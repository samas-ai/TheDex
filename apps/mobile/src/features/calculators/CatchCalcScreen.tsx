import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  assertGeneration,
  CATCH_STATUSES,
  catchChance,
  cumulativeCatchChance,
  isTypeName,
  type CatchConditions,
  type CatchResult,
  type CatchStatus,
} from '@thedex/engine';
import { getChecklistEntries, getPokemonProfile, listItems } from '@thedex/db';
import { FONT_SIZES, SPACING } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { ItemIcon } from '../../entities/item/ItemIcon';
import { PokemonPicker } from '../../entities/pokemon/PokemonPicker';
import { PokemonSprite } from '../../entities/pokemon/PokemonSprite';
import { TypeBadge } from '../../entities/pokemon/TypeBadge';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { Icon } from '../../shared/ui/Icon';
import { NumberField } from '../../shared/ui/NumberField';
import { PickerModal } from '../../shared/ui/PickerModal';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { Card, Chip, InfoRow, Loading, Section, ThemedText } from '../../shared/ui/primitives';
import {
  captureBonusOptions,
  expectedThrows,
  formatChance,
  hpFromPercent,
  OTHER_CAPTURE_SYSTEMS,
  relevantConditions,
  wildMaxHp,
} from './catch-logic';

const HP_PRESETS = [100, 50, 25, 10, 1] as const;
const FLAGS = ['night', 'cave', 'fishing', 'surfing', 'underwater', 'alreadyCaught'] as const;

/**
 * RF11.2: chance per throw and of a critical capture with the selected game's generation
 * formula — species catch rate, level, HP %, status, ball and the ball/turn/area conditions.
 */
export function CatchCalcScreen({ initialPokemonId }: { initialPokemonId: number | null }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx, game } = useGame();
  const { typeName } = useCatalog();
  const gen = assertGeneration(ctx.generationId);
  const [pokemonId, setPokemonId] = useState(initialPokemonId);
  const [level, setLevel] = useState(30);
  const [hpPercent, setHpPercent] = useState(100);
  const [status, setStatus] = useState<CatchStatus>('none');
  const [ball, setBall] = useState('poke-ball');
  const [conditions, setConditions] = useState<CatchConditions>({
    turn: 0,
    playerLevel: 50,
    badges: 8,
    catchingPower: 0,
    captureBonus: 100,
  });
  const [caughtOverride, setCaughtOverride] = useState<number | null>(null);
  const [picker, setPicker] = useState<'pokemon' | 'ball' | null>(null);

  const profile = useAsync(
    async () => (pokemonId ? getPokemonProfile(db, pokemonId, ctx) : null),
    [db, ctx, pokemonId],
  );
  const balls = useAsync(
    () => listItems(db, ctx, { groups: ['ball'], inGameOnly: true }),
    [db, ctx],
  );
  // Species caught (critical captures) default to the user's National Dex checklist.
  const checklistCaught = useAsync(
    async () =>
      (await getChecklistEntries(db, 'national')).filter(
        (entry) => entry.formId === 0 && (entry.caught || entry.shinyCaught),
      ).length,
    [db],
  );
  const speciesCaught = caughtOverride ?? checklistCaught.data ?? 0;
  const accent = useTypeAccent(profile.data?.types[0]);
  const keys = relevantConditions(ball, gen);
  const data = profile.data;
  const maxHp = data?.stats ? wildMaxHp(data.stats.hp, level, gen) : null;
  const currentHp = maxHp === null ? null : hpFromPercent(maxHp, hpPercent);
  const ballName = balls.data?.find((item) => item.identifier === ball)?.name ?? ball;
  const set = (patch: Partial<CatchConditions>) => setConditions({ ...conditions, ...patch });

  const result = useMemo((): CatchResult | Error | null => {
    if (!data || maxHp === null || currentHp === null) return null;
    try {
      return catchChance({
        gen,
        catchRate: Math.max(1, data.species.captureRate),
        maxHp,
        currentHp,
        level,
        status,
        ball,
        target: {
          speciesId: data.speciesId,
          types: data.types.filter(isTypeName),
          weightHg: data.weightHg,
          baseSpeed: data.stats?.speed,
        },
        conditions: { ...conditions, speciesCaught },
      });
    } catch (e) {
      return e instanceof Error ? e : new Error(String(e));
    }
  }, [data, maxHp, currentHp, level, status, ball, conditions, speciesCaught, gen]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: t('nav.catchCalc') }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {OTHER_CAPTURE_SYSTEMS.has(game.identifier) ? (
          <ThemedText variant="small" color={theme.colors.warning}>
            {t('catchCalc.otherSystem', { game: game.name, number: gen })}
          </ThemedText>
        ) : null}
        <Pressable
          onPress={() => setPicker('pokemon')}
          accessibilityRole="button"
          accessibilityLabel={data?.name ?? t('statCalc.pick')}
        >
          <Card style={styles.head}>
            {pokemonId ? <PokemonSprite pokemonId={pokemonId} style="pixel" size={56} /> : null}
            <View style={styles.flex}>
              <ThemedText variant="title" bold color={pokemonId ? undefined : accent.text}>
                {data?.name ?? t('statCalc.pick')}
              </ThemedText>
              <View style={styles.wrap}>
                {data?.types.map((type) => (
                  <TypeBadge key={type} type={type} name={typeName(type)} size="sm" />
                ))}
              </View>
              {data ? (
                <ThemedText variant="caption" muted>
                  {t('catchCalc.catchRate', { rate: data.species.captureRate })}
                </ThemedText>
              ) : null}
            </View>
            <Icon name="chevron-right" color={theme.colors.textMuted} />
          </Card>
        </Pressable>

        {pokemonId === null ? null : !data ? (
          <Loading />
        ) : (
          <>
            <ResultCard result={result} accentColor={accent.text} />

            <Section title={t('catchCalc.wild')}>
              <Card>
                <View style={styles.line}>
                  <ThemedText muted style={styles.flex}>
                    {t('catchCalc.level')}
                  </ThemedText>
                  <NumberField
                    value={level}
                    min={1}
                    max={100}
                    onChange={setLevel}
                    accessibilityLabel={t('catchCalc.level')}
                  />
                </View>
                <View style={styles.line}>
                  <ThemedText muted style={styles.flex}>
                    {t('catchCalc.hp', { current: currentHp ?? '—', max: maxHp ?? '—' })}
                  </ThemedText>
                  <NumberField
                    value={hpPercent}
                    min={1}
                    max={100}
                    onChange={setHpPercent}
                    accessibilityLabel={t('catchCalc.hpPercent')}
                  />
                  <ThemedText muted>%</ThemedText>
                </View>
                <View style={styles.wrap}>
                  {HP_PRESETS.map((preset) => (
                    <Chip
                      key={preset}
                      label={`${preset}%`}
                      selected={hpPercent === preset}
                      onPress={() => setHpPercent(preset)}
                    />
                  ))}
                </View>
                <View style={styles.wrap}>
                  {CATCH_STATUSES.map((key) => (
                    <Chip
                      key={key}
                      label={t(`catchCalc.status.${key}`)}
                      selected={status === key}
                      onPress={() => setStatus(key)}
                    />
                  ))}
                </View>
              </Card>
            </Section>

            <Section title={t('catchCalc.ball')}>
              <Card>
                <Pressable
                  onPress={() => setPicker('ball')}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('catchCalc.ball')}: ${ballName}`}
                  style={styles.line}
                >
                  <ItemIcon
                    itemId={balls.data?.find((b) => b.identifier === ball)?.id ?? 0}
                    size={28}
                  />
                  <ThemedText bold style={styles.flex}>
                    {ballName}
                  </ThemedText>
                  <Icon name="chevron-right" color={theme.colors.textMuted} />
                </Pressable>
                {keys.has('turn') ? (
                  <View style={styles.line}>
                    <ThemedText muted style={styles.flex}>
                      {t('catchCalc.turn')}
                    </ThemedText>
                    <NumberField
                      value={(conditions.turn ?? 0) + 1}
                      min={1}
                      max={999}
                      onChange={(turn) => set({ turn: turn - 1 })}
                      accessibilityLabel={t('catchCalc.turn')}
                    />
                  </View>
                ) : null}
                {keys.has('playerLevel') ? (
                  <View style={styles.line}>
                    <ThemedText muted style={styles.flex}>
                      {t('catchCalc.playerLevel')}
                    </ThemedText>
                    <NumberField
                      value={conditions.playerLevel ?? 50}
                      min={1}
                      max={100}
                      onChange={(playerLevel) => set({ playerLevel })}
                      accessibilityLabel={t('catchCalc.playerLevel')}
                    />
                  </View>
                ) : null}
                <View style={styles.wrap}>
                  {FLAGS.filter((flag) => keys.has(flag)).map((flag) => (
                    <Chip
                      key={flag}
                      label={t(`catchCalc.flags.${flag}`)}
                      selected={!!conditions[flag]}
                      onPress={() => set({ [flag]: !conditions[flag] } as Partial<CatchConditions>)}
                    />
                  ))}
                  {keys.has('loveMatch')
                    ? (['same-gender', 'opposite-gender'] as const).map((match) => (
                        <Chip
                          key={match}
                          label={t(`catchCalc.love.${match}`)}
                          selected={conditions.loveMatch === match}
                          onPress={() =>
                            set({ loveMatch: conditions.loveMatch === match ? null : match })
                          }
                        />
                      ))
                    : null}
                </View>
              </Card>
            </Section>

            {gen >= 5 ? (
              <Section title={t('catchCalc.game')}>
                <Card>
                  <View style={styles.line}>
                    <ThemedText muted style={styles.flex}>
                      {t('catchCalc.speciesCaught')}
                    </ThemedText>
                    <NumberField
                      value={speciesCaught}
                      min={0}
                      max={1100}
                      onChange={setCaughtOverride}
                      accessibilityLabel={t('catchCalc.speciesCaught')}
                      width={64}
                    />
                  </View>
                  {keys.has('captureBonus') ? (
                    <View style={styles.wrap}>
                      {captureBonusOptions(gen).map((bonus) => (
                        <Chip
                          key={bonus}
                          label={
                            bonus === 100
                              ? t(`catchCalc.bonus.none`)
                              : t(`catchCalc.bonus.gen${gen as 5 | 6 | 7}`, { value: bonus / 100 })
                          }
                          selected={(conditions.captureBonus ?? 100) === bonus}
                          onPress={() => set({ captureBonus: bonus })}
                        />
                      ))}
                    </View>
                  ) : null}
                  {keys.has('badges') ? (
                    <View style={styles.line}>
                      <ThemedText muted style={styles.flex}>
                        {t('catchCalc.badges')}
                      </ThemedText>
                      <NumberField
                        value={conditions.badges ?? 8}
                        min={0}
                        max={8}
                        onChange={(badges) => set({ badges })}
                        accessibilityLabel={t('catchCalc.badges')}
                      />
                    </View>
                  ) : null}
                  {keys.has('catchingPower') ? (
                    <View style={styles.wrap}>
                      {([0, 1, 2, 3] as const).map((power) => (
                        <Chip
                          key={power}
                          label={t('catchCalc.catchingPower', { level: power })}
                          selected={(conditions.catchingPower ?? 0) === power}
                          onPress={() => set({ catchingPower: power })}
                        />
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.wrap}>
                    {keys.has('darkGrass') ? (
                      <Chip
                        label={t('catchCalc.flags.darkGrass')}
                        selected={!!conditions.darkGrass}
                        onPress={() => set({ darkGrass: !conditions.darkGrass })}
                      />
                    ) : null}
                    {keys.has('catchingCharm') ? (
                      <Chip
                        label={t('catchCalc.flags.catchingCharm')}
                        selected={!!conditions.catchingCharm}
                        onPress={() => set({ catchingCharm: !conditions.catchingCharm })}
                      />
                    ) : null}
                    {keys.has('underLevelPenalty') ? (
                      <Chip
                        label={t('catchCalc.flags.underLevelPenalty')}
                        selected={!!conditions.underLevelPenalty}
                        onPress={() => set({ underLevelPenalty: !conditions.underLevelPenalty })}
                      />
                    ) : null}
                    {keys.has('offGuard') ? (
                      <Chip
                        label={t('catchCalc.flags.offGuard')}
                        selected={!!conditions.offGuard}
                        onPress={() => set({ offGuard: !conditions.offGuard })}
                      />
                    ) : null}
                  </View>
                </Card>
              </Section>
            ) : null}
            <ThemedText variant="caption" muted>
              {t('catchCalc.note')}
            </ThemedText>
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
        }}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'ball'}
        title={t('catchCalc.ball')}
        items={(balls.data ?? []).map((item) => ({
          key: item.identifier,
          title: item.name,
          keywords: item.identifier,
          leading: <ItemIcon itemId={item.id} size={28} />,
        }))}
        selected={ball}
        onSelect={(key) => {
          if (key !== null) setBall(key);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

function ResultCard({
  result,
  accentColor,
}: {
  result: CatchResult | Error | null;
  accentColor: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  if (result === null) return <ThemedText muted>{t('catchCalc.noStats')}</ThemedText>;
  if (result instanceof Error) {
    return <ThemedText color={theme.colors.danger}>{t('catchCalc.error')}</ThemedText>;
  }
  const throws = expectedThrows(result.probability);
  return (
    <Card>
      <ThemedText variant="caption" muted>
        {t('catchCalc.chance')}
      </ThemedText>
      <ThemedText bold color={accentColor} style={styles.big}>
        {formatChance(result.probability)}%
      </ThemedText>
      <ProgressBar value={result.probability} color={accentColor} />
      {result.guaranteed ? (
        <ThemedText variant="small" color={theme.colors.success}>
          {t('catchCalc.guaranteed')}
        </ThemedText>
      ) : (
        <>
          {result.criticalChance > 0 ? (
            <InfoRow
              label={t('catchCalc.critical')}
              value={`${formatChance(result.criticalChance)}%`}
            />
          ) : null}
          {result.shakeProbability !== null ? (
            <InfoRow
              label={t('catchCalc.shake')}
              value={`${formatChance(result.shakeProbability)}%`}
            />
          ) : null}
          <InfoRow
            label={t('catchCalc.expected')}
            value={throws === null ? '—' : throws.toFixed(1)}
          />
          {[5, 10].map((count) => (
            <InfoRow
              key={count}
              label={t('catchCalc.within', { count })}
              value={`${formatChance(cumulativeCatchChance(result.probability, count))}%`}
            />
          ))}
        </>
      )}
      {result.clamped ? (
        <ThemedText variant="caption" color={theme.colors.warning}>
          {t('catchCalc.clamped')}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  line: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minHeight: 40 },
  big: { fontSize: FONT_SIZES.display },
});
