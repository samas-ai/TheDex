import { router, Stack } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  assertGeneration,
  dvFromIv,
  ivFromDv,
  maxIv,
  showdownEvLimits,
  TYPE_NAMES,
  type ShowdownStat,
} from '@thedex/engine';
import {
  getLearnableMoveIds,
  getMoveSummaries,
  getPokemonProfile,
  listItems,
  listMoves,
  listNatures,
  type TeamMember,
} from '@thedex/db';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { ItemIcon } from '../../entities/item/ItemIcon';
import { DamageClassBadge } from '../../entities/move/DamageClassBadge';
import { PokemonPicker } from '../../entities/pokemon/PokemonPicker';
import { PokemonSprite } from '../../entities/pokemon/PokemonSprite';
import { TypeBadge } from '../../entities/pokemon/TypeBadge';
import { evsValid, evTotal, setEv } from '../../entities/stats/evs';
import { baseOf, finalStats, gameIvs, natureEffect, statsOf } from '../../entities/stats/stat-calc';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGameContextFor } from '../../shared/game/useGameContextFor';
import { useAsync } from '../../shared/hooks/useAsync';
import { useSettings } from '../../shared/settings/SettingsProvider';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { Icon } from '../../shared/ui/Icon';
import { NumberField } from '../../shared/ui/NumberField';
import { PickerModal, type PickerItem } from '../../shared/ui/PickerModal';
import {
  Button,
  Card,
  Chip,
  Loading,
  Message,
  Section,
  ThemedText,
} from '../../shared/ui/primitives';
import {
  genderOptions,
  HIDDEN_POWER,
  HIDDEN_POWER_TYPES,
  illegalMoves,
  moveClassFor,
  moveSlots,
  moveTypeFor,
  setMove,
  slotDefaults,
} from './team-logic';
import { useTeam } from './team-store';

type Picker = 'pokemon' | 'nature' | 'item' | 'tera' | 'hpType' | { readonly move: number } | null;

/**
 * RF08.2: every attribute of one slot — nickname, level, gender, shiny, ability, nature, item,
 * Tera Type, four moves (with the optional legality check against the game's learnset) and
 * IVs/EVs with the final stats computed live by the engine.
 */
export function SlotEditorScreen({ teamId, slot }: { teamId: string; slot: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { settings } = useSettings();
  const { typeName, statName, damageClassName } = useCatalog();
  const { team, update } = useTeam(teamId);
  const game = useGameContextFor(team?.gameId);
  const ctx = game?.ctx ?? null;
  const member = team?.members[slot];
  const pokemonId = member?.pokemonId;
  const [picker, setPicker] = useState<Picker>(null);
  const [allMoves, setAllMoves] = useState(false);

  const profile = useAsync(
    async () => (ctx && pokemonId ? getPokemonProfile(db, pokemonId, ctx) : null),
    [db, ctx, pokemonId],
  );
  // Its own moves plus the base variety's and the pre-evolutions' (egg moves…).
  const learnableIds = useAsync(
    async () => (ctx && pokemonId ? getLearnableMoveIds(db, pokemonId, ctx) : null),
    [db, ctx, pokemonId],
  );
  const checkLegality = !!game?.features.hasLearnsets;
  // Without learnsets for the game (PokeAPI gaps), every move of the game is offered.
  const showAll = allMoves || !checkLegality;
  const gameMoves = useAsync(async () => (ctx ? listMoves(db, ctx) : null), [db, ctx]);
  const natures = useAsync(async () => (ctx ? listNatures(db, ctx) : null), [db, ctx]);
  const items = useAsync(
    async () => (ctx ? listItems(db, ctx, { groups: ['held', 'berry'], inGameOnly: true }) : null),
    [db, ctx],
  );
  const moveKey = member?.moveIds.join(',') ?? '';
  const chosenMoves = useAsync(
    async () =>
      ctx && member
        ? getMoveSummaries(
            db,
            ctx,
            moveSlots(member).filter((id): id is number => id !== null),
          )
        : null,
    // moveKey stands for the member's move ids.
    [db, ctx, moveKey],
  );
  const accent = useTypeAccent(profile.data?.types[0]);

  const learnable = useMemo(() => learnableIds.data ?? new Set<number>(), [learnableIds.data]);

  const moveItems = useMemo((): PickerItem<number>[] => {
    const describe = (type: string | null, damageClass: string | null, power: number | null) =>
      [type ? typeName(type) : null, damageClass ? damageClassName(damageClass) : null, power]
        .filter((part) => part !== null)
        .join(' · ');
    return (gameMoves.data ?? [])
      .filter((move) => showAll || learnable.has(move.id))
      .map((move) => ({
        key: move.id,
        title: move.name,
        subtitle: describe(move.type, move.damageClass, move.power),
        right: <TypeBadge type={move.type} name={typeName(move.type)} size="sm" />,
        dimmed: checkLegality && !learnable.has(move.id),
      }));
  }, [showAll, checkLegality, gameMoves.data, learnable, typeName, damageClassName]);

  if (!team || !ctx || !game) {
    return team === null ? <Message text={t('teamEditor.notFound')} /> : <Loading />;
  }
  if (!member) return <Message text={t('slot.notFound')} />;
  const gen = assertGeneration(team.generationId);
  const data = profile.data;

  const set = (patch: Partial<TeamMember>) =>
    update((current) => ({
      ...current,
      members: current.members.map((m, index) => (index === slot ? { ...m, ...patch } : m)),
    }));

  const changePokemon = async (id: number) => {
    setPicker(null);
    const next = await getPokemonProfile(db, id, ctx);
    set({
      pokemonId: id,
      ...slotDefaults(next?.abilities ?? [], next?.species.genderRate ?? -1, gen),
    });
  };

  const removeMember = () =>
    Alert.alert(t('slot.removeTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: () => {
          update((current) => ({
            ...current,
            members: current.members.filter((_, index) => index !== slot),
          }));
          router.back();
        },
      },
    ]);

  const illegal = new Set(checkLegality ? illegalMoves(member, learnable) : []);
  const hasHiddenPower = moveSlots(member).some(
    (id) => id !== null && chosenMoves.data?.get(id)?.identifier === HIDDEN_POWER,
  );
  const ivs = gameIvs(member.ivs, gen);
  const stats = data?.stats ? finalStats(data.stats, { ...member, ivs }, gen) : null;
  const limits = showdownEvLimits(gen);
  const total = evTotal(gen === 1 ? { ...member.evs, spd: 0 } : member.evs);
  const genders = genderOptions(data?.species.genderRate ?? -1, gen);
  const ability = data?.abilities.find((a) => a.id === member.abilityId);
  const nature = natures.data?.find((n) => n.identifier === member.nature);
  const itemName = items.data?.find((item) => item.id === member.itemId)?.name;
  const displayName = data?.name ?? '';

  const setIv = (stat: ShowdownStat, value: number) => {
    const stored = gen <= 2 ? ivFromDv(value) : value;
    set({
      ivs: {
        ...member.ivs,
        [stat]: stored,
        ...(gen === 1 && stat === 'spa' ? { spd: stored } : {}),
      },
    });
  };
  const setEvValue = (stat: ShowdownStat, value: number) => {
    let evs = setEv(member.evs, stat, value, gen);
    if (gen === 1 && stat === 'spa') evs = { ...evs, spd: evs.spa };
    set({ evs });
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen
        options={{
          title: member.nickname || displayName,
          headerStyle: { backgroundColor: accent.tint },
          headerTintColor: accent.text,
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.head}>
          <PokemonSprite
            pokemonId={member.pokemonId}
            style={settings.spriteStyle}
            shiny={member.shiny}
            size={96}
          />
          <View style={styles.flex}>
            <ThemedText variant="title" bold>
              {displayName}
            </ThemedText>
            <View style={styles.wrapRow}>
              {data?.types.map((type) => (
                <TypeBadge key={type} type={type} name={typeName(type)} size="sm" />
              ))}
            </View>
            {data && !data.stats ? (
              <ThemedText variant="caption" color={theme.colors.warning}>
                {t('teamEditor.notInGeneration')}
              </ThemedText>
            ) : null}
            <ThemedText color={accent.text} onPress={() => setPicker('pokemon')}>
              {t('slot.change')}
            </ThemedText>
          </View>
        </Card>

        <Section title={t('slot.details')}>
          <Card>
            <TextInput
              value={member.nickname}
              onChangeText={(nickname) => set({ nickname })}
              placeholder={t('slot.nickname')}
              placeholderTextColor={theme.colors.textMuted}
              maxLength={40}
              accessibilityLabel={t('slot.nickname')}
              style={[
                styles.input,
                { color: theme.colors.text, backgroundColor: theme.colors.surfaceVariant },
              ]}
            />
            <View style={styles.line}>
              <ThemedText muted style={styles.flex}>
                {t('slot.level')}
              </ThemedText>
              <NumberField
                value={member.level}
                min={1}
                max={100}
                onChange={(level) => set({ level })}
                accessibilityLabel={t('slot.level')}
              />
            </View>
            {gen >= 2 ? (
              <View style={styles.wrapRow}>
                {genders.map((gender) => (
                  <Chip
                    key={gender || 'any'}
                    label={t(`slot.gender.${gender || 'any'}`)}
                    selected={member.gender === gender}
                    onPress={() => set({ gender })}
                  />
                ))}
                <Chip
                  label={t('slot.shiny')}
                  selected={member.shiny}
                  onPress={() => set({ shiny: !member.shiny })}
                />
              </View>
            ) : null}
          </Card>
        </Section>

        {gen >= 3 && data ? (
          <Section title={t('slot.ability')}>
            <Card>
              <View style={styles.wrapRow}>
                {data.abilities.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.isHidden ? `${a.name} (${t('slot.hidden')})` : a.name}
                    selected={member.abilityId === a.id}
                    onPress={() => set({ abilityId: a.id })}
                  />
                ))}
              </View>
              {ability === undefined && member.abilityId !== null ? (
                <ThemedText variant="caption" color={theme.colors.warning}>
                  {t('slot.abilityNotAvailable')}
                </ThemedText>
              ) : null}
            </Card>
          </Section>
        ) : null}

        <Section title={t('slot.build')}>
          <Card>
            {gen >= 3 ? (
              <ChoiceRow
                label={t('slot.nature')}
                value={
                  nature
                    ? nature.increased
                      ? `${nature.name} (+${nature.increased.name} −${nature.decreased?.name})`
                      : nature.name
                    : t('slot.neutral')
                }
                onPress={() => setPicker('nature')}
              />
            ) : null}
            {gen >= 2 ? (
              <ChoiceRow
                label={t('slot.item')}
                value={itemName ?? t('common.none')}
                leading={
                  member.itemId !== null ? <ItemIcon itemId={member.itemId} size={24} /> : null
                }
                onPress={() => setPicker('item')}
              />
            ) : null}
            {game.features.hasTera ? (
              <ChoiceRow
                label={t('slot.tera')}
                value={
                  member.teraType === null
                    ? t('common.none')
                    : member.teraType === 'stellar'
                      ? t('slot.stellar')
                      : typeName(member.teraType)
                }
                onPress={() => setPicker('tera')}
              />
            ) : null}
          </Card>
        </Section>

        <Section title={t('slot.moves')}>
          <Card>
            {moveSlots(member).map((moveId, index) => {
              const move = moveId === null ? undefined : chosenMoves.data?.get(moveId);
              const moveType = move ? moveTypeFor(move, member) : null;
              const moveClass = move ? moveClassFor(move, member, gen) : null;
              return (
                <Pressable
                  key={index}
                  onPress={() => setPicker({ move: index })}
                  accessibilityRole="button"
                  accessibilityLabel={move?.name ?? t('slot.emptyMove')}
                  style={({ pressed }) => [
                    styles.moveRow,
                    { backgroundColor: pressed ? theme.colors.surfaceVariant : 'transparent' },
                  ]}
                >
                  {moveType ? (
                    <TypeBadge type={moveType} name={typeName(moveType)} size="sm" />
                  ) : null}
                  <ThemedText bold={!!move} muted={!move} style={styles.flex}>
                    {move?.name ?? t('slot.emptyMove')}
                  </ThemedText>
                  {moveClass ? <DamageClassBadge damageClass={moveClass} size="sm" /> : null}
                  {moveId !== null && illegal.has(moveId) ? (
                    <Icon name="alert" size={18} color={theme.colors.warning} />
                  ) : null}
                </Pressable>
              );
            })}
            {hasHiddenPower && gen >= 2 && gen <= 7 ? (
              <ChoiceRow
                label={t('slot.hpType')}
                value={member.hpType ? typeName(member.hpType) : t('slot.hpTypeAuto')}
                onPress={() => setPicker('hpType')}
              />
            ) : null}
            {illegal.size > 0 ? (
              <ThemedText variant="caption" color={theme.colors.warning}>
                {t('slot.illegalMoves')}
              </ThemedText>
            ) : null}
            {!checkLegality ? (
              <ThemedText variant="caption" muted>
                {t('slot.noLearnsets')}
              </ThemedText>
            ) : null}
          </Card>
        </Section>

        <Section title={t('slot.stats')}>
          <Card>
            <View style={styles.statRow}>
              <View style={styles.statLabel} />
              <ThemedText variant="caption" muted style={styles.statBase}>
                {t('slot.base')}
              </ThemedText>
              <ThemedText variant="caption" muted style={styles.statField}>
                {gen <= 2 ? 'DV' : 'IV'}
              </ThemedText>
              <ThemedText variant="caption" muted style={styles.statField}>
                EV
              </ThemedText>
              <ThemedText variant="caption" muted style={styles.statTotal}>
                {t('slot.total')}
              </ThemedText>
            </View>
            {statsOf(gen).map((stat) => {
              const effect = natureEffect(member.nature, stat, gen);
              const derivedHp = gen <= 2 && stat === 'hp';
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
                    {statName(gen === 1 && stat === 'spa' ? 'special' : engineName(stat))}
                    {effect > 1 ? ' ↑' : effect < 1 ? ' ↓' : ''}
                  </ThemedText>
                  <ThemedText variant="small" style={styles.statBase}>
                    {data?.stats ? baseOf(data.stats, stat, gen) : '—'}
                  </ThemedText>
                  <View style={styles.statField}>
                    <NumberField
                      value={
                        derivedHp
                          ? ivs.hp
                          : gen <= 2
                            ? dvFromIv(member.ivs[stat])
                            : member.ivs[stat]
                      }
                      min={0}
                      max={maxIv(gen)}
                      editable={!derivedHp}
                      onChange={(value) => setIv(stat, value)}
                      accessibilityLabel={`${stat} IV`}
                      width={48}
                    />
                  </View>
                  <View style={styles.statField}>
                    <NumberField
                      value={member.evs[stat]}
                      min={0}
                      max={limits.perStat}
                      onChange={(value) => setEvValue(stat, value)}
                      accessibilityLabel={`${stat} EV`}
                      width={56}
                    />
                  </View>
                  <ThemedText bold style={styles.statTotal} color={accent.text}>
                    {stats?.[stat] ?? '—'}
                  </ThemedText>
                </View>
              );
            })}
            <ThemedText
              variant="caption"
              color={evsValid(member.evs, gen) ? theme.colors.textMuted : theme.colors.danger}
            >
              {limits.total === null
                ? t('slot.evsNoTotal')
                : t('slot.evTotal', { total, max: limits.total, left: limits.total - total })}
            </ThemedText>
            {gen <= 2 ? (
              <ThemedText variant="caption" muted>
                {t('slot.dvNote')}
              </ThemedText>
            ) : null}
          </Card>
        </Section>

        <Button
          label={t('slot.remove')}
          color={theme.colors.surfaceVariant}
          textColor={theme.colors.danger}
          onPress={removeMember}
        />
      </ScrollView>

      <PokemonPicker
        visible={picker === 'pokemon'}
        title={t('slot.change')}
        ctx={ctx}
        onSelect={(entry) => void changePokemon(entry.id)}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'nature'}
        title={t('slot.nature')}
        items={(natures.data ?? []).map((n) => ({
          key: n.identifier,
          title: n.name,
          subtitle: n.increased
            ? `+${n.increased.name} −${n.decreased?.name ?? ''}`
            : t('slot.neutral'),
          keywords: n.identifier,
        }))}
        selected={member.nature}
        allowNone
        onSelect={(key) => {
          set({ nature: key as TeamMember['nature'] });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'item'}
        title={t('slot.item')}
        items={(items.data ?? []).map((item) => ({
          key: item.id,
          title: item.name,
          subtitle: t(`itemDex.groups.${item.group}`),
          keywords: item.identifier,
          leading: <ItemIcon itemId={item.id} size={28} />,
        }))}
        selected={member.itemId}
        allowNone
        onSelect={(itemId) => {
          set({ itemId });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'hpType'}
        title={t('slot.hpType')}
        items={HIDDEN_POWER_TYPES.map((type) => ({
          key: type as string,
          title: typeName(type),
          leading: <TypeBadge type={type} name={typeName(type)} size="sm" />,
        }))}
        selected={member.hpType}
        allowNone
        onSelect={(key) => {
          set({ hpType: key as TeamMember['hpType'] });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'tera'}
        title={t('slot.tera')}
        items={[
          ...TYPE_NAMES.map((type) => ({
            key: type as string,
            title: typeName(type),
            leading: <TypeBadge type={type} name={typeName(type)} size="sm" />,
          })),
          { key: 'stellar', title: t('slot.stellar') },
        ]}
        selected={member.teraType}
        allowNone
        onSelect={(key) => {
          set({ teraType: key as TeamMember['teraType'] });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={typeof picker === 'object' && picker !== null}
        title={t('slot.moves')}
        items={moveItems}
        selected={
          typeof picker === 'object' && picker !== null ? moveSlots(member)[picker.move] : null
        }
        allowNone
        header={
          checkLegality ? (
            <View style={styles.wrapRow}>
              <Chip
                label={t('slot.learnable')}
                selected={!allMoves}
                onPress={() => setAllMoves(false)}
              />
              <Chip
                label={t('slot.allMoves')}
                selected={allMoves}
                onPress={() => setAllMoves(true)}
              />
            </View>
          ) : null
        }
        emptyText={t('slot.noMoves')}
        onSelect={(moveId) => {
          if (typeof picker === 'object' && picker !== null) {
            set({ moveIds: setMove(member, picker.move, moveId) });
          }
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

/** PokeAPI stat identifier of a Showdown key (names come from the game DB). */
function engineName(stat: ShowdownStat): string {
  const names: Record<ShowdownStat, string> = {
    hp: 'hp',
    atk: 'attack',
    def: 'defense',
    spa: 'special-attack',
    spd: 'special-defense',
    spe: 'speed',
  };
  return names[stat];
}

function ChoiceRow({
  label,
  value,
  leading,
  onPress,
}: {
  label: string;
  value: string;
  leading?: ReactNode;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.choice, { opacity: pressed ? 0.6 : 1 }]}
    >
      <ThemedText muted style={styles.choiceLabel}>
        {label}
      </ThemedText>
      <View style={styles.choiceValue}>
        {leading}
        <ThemedText bold numberOfLines={1} style={styles.shrink}>
          {value}
        </ThemedText>
        <Icon name="chevron-right" size={20} color={theme.colors.textMuted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  input: {
    borderRadius: RADII.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  choice: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 40 },
  choiceLabel: { flex: 2 },
  choiceValue: {
    flex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.xs,
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 40,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACING.xs,
  },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, minHeight: 36 },
  statLabel: { flex: 1 },
  statBase: { width: 36, textAlign: 'right' },
  statField: { width: 60, alignItems: 'center' },
  statTotal: { width: 44, textAlign: 'right' },
});
