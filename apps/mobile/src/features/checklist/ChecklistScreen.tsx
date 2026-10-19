import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  checklistScope,
  getChecklistEntries,
  listChecklistDex,
  setChecklistEntries,
  type ChecklistDexEntry,
} from '@thedex/db';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { PokemonSprite } from '../../entities/pokemon/PokemonSprite';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useUserDataVersion } from '../../shared/db/user-data-events';
import { dexNumber } from '../../shared/format';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useEntitySearch } from '../../shared/hooks/useEntitySearch';
import { ProGate } from '../../shared/pro/ProGate';
import { useRequirePro } from '../../shared/pro/ProProvider';
import { useSettings } from '../../shared/settings/SettingsProvider';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Icon, type IconName } from '../../shared/ui/Icon';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { SearchField } from '../../shared/ui/SearchField';
import { Sheet } from '../../shared/ui/Sheet';
import { Button, Card, Chip, Loading, Message, ThemedText } from '../../shared/ui/primitives';
import {
  batchLevel,
  CHECKLIST_FILTERS,
  checklistGroups,
  checklistProgress,
  checklistRows,
  flagsOf,
  LEVEL_NAMES,
  levelsById,
  matchesFilter,
  percentOf,
  tapLevel,
  type ChecklistFilter,
  type ChecklistGroup,
  type ChecklistLevel,
} from './checklist-logic';

const MARKS: readonly { level: 1 | 2 | 3; icon: IconName; key: 'seen' | 'caught' | 'shiny' }[] = [
  { level: 1, icon: 'eye', key: 'seen' },
  { level: 2, icon: 'pokeball', key: 'caught' },
  { level: 3, icon: 'star-four-points', key: 'shiny' },
];

/**
 * RF09: collection tracker for the National Dex or the selected game — seen / caught / shiny
 * caught per Pokémon or per generation/box, progress bars and Living Dex / shiny filters. Shiny
 * marks and the shiny filter are PRO (`checklist.shiny`, RNF08).
 */
export function ChecklistScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx, game } = useGame();
  const { settings, updateSettings } = useSettings();
  const kind = settings.checklistKind;
  const scope = checklistScope(kind, ctx.gameId);
  const dex = useAsync(() => listChecklistDex(db, ctx, kind), [db, ctx, kind]);
  const userData = useUserDataVersion();
  const requirePro = useRequirePro();
  const stored = useAsync(
    async () => ({ scope, entries: await getChecklistEntries(db, scope) }),
    [db, scope, userData],
  );
  const [levels, setLevels] = useState<ReadonlyMap<number, ChecklistLevel>>(new Map());
  useEffect(() => {
    if (stored.data?.scope === scope) setLevels(levelsById(stored.data.entries));
  }, [stored.data, scope]);
  const [filter, setFilter] = useState<ChecklistFilter>('all');
  const [query, setQuery] = useState('');
  const [batch, setBatch] = useState<ChecklistGroup | null>(null);
  const hits = useEntitySearch('pokemon', query);

  const groups = useMemo(() => checklistGroups(dex.data ?? [], kind), [dex.data, kind]);
  const rows = useMemo(
    () =>
      checklistRows(
        groups,
        (entry) =>
          matchesFilter(levels.get(entry.pokemonId) ?? 0, filter) &&
          (hits === null || hits.has(entry.pokemonId)),
      ),
    [groups, levels, filter, hits],
  );
  const progress = checklistProgress(dex.data ?? [], levels);

  /** Sets each entry's level (computed from its current one) and saves them in one batch. */
  const mark = useCallback(
    (
      entries: readonly ChecklistDexEntry[],
      levelFor: (current: ChecklistLevel) => ChecklistLevel,
    ) => {
      const changes = entries.map((entry) => ({
        pokemonId: entry.pokemonId,
        level: levelFor(levels.get(entry.pokemonId) ?? 0),
      }));
      setLevels((current) => {
        const next = new Map(current);
        for (const change of changes) next.set(change.pokemonId, change.level);
        return next;
      });
      void setChecklistEntries(
        db,
        scope,
        changes.map((change) => ({ pokemonId: change.pokemonId, ...flagsOf(change.level) })),
        Date.now(),
      );
    },
    [db, scope, levels],
  );
  const onTap = useCallback(
    (entry: ChecklistDexEntry, current: ChecklistLevel, tapped: 1 | 2 | 3) => {
      const apply = () => mark([entry], () => tapLevel(current, tapped));
      if (tapped === 3) requirePro('checklist.shiny', apply);
      else apply();
    },
    [mark, requirePro],
  );
  const groupTitle = (group: ChecklistGroup) =>
    group.kind === 'generation'
      ? t('common.generation', { number: group.number })
      : t('checklist.box', { number: group.number });

  const bars = [
    { key: 'seen', done: progress.seen, color: theme.colors.textMuted },
    { key: 'caught', done: progress.caught, color: theme.colors.primary },
    { key: 'shiny', done: progress.shiny, color: theme.colors.warning },
  ] as const;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: t('nav.checklist') }} />
      <FlashList
        data={rows}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.type}
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        extraData={levels}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.wrap}>
              {(['national', 'game'] as const).map((key) => (
                <Chip
                  key={key}
                  label={key === 'game' ? game.name : t('checklist.scope.national')}
                  selected={kind === key}
                  onPress={() => updateSettings({ checklistKind: key })}
                />
              ))}
            </View>
            <Card>
              {bars.map((bar) => {
                const row = (
                  <View key={bar.key} style={styles.bar}>
                    <ThemedText variant="small" style={styles.barLabel}>
                      {t(`checklist.status.${bar.key}`)}
                    </ThemedText>
                    <ProgressBar
                      value={progress.total === 0 ? 0 : bar.done / progress.total}
                      color={bar.color}
                    />
                    <ThemedText variant="caption" muted style={styles.barValue}>
                      {t('checklist.progress', {
                        done: bar.done,
                        total: progress.total,
                        percent: percentOf(bar.done, progress.total),
                      })}
                    </ThemedText>
                  </View>
                );
                return bar.key === 'shiny' ? (
                  <ProGate
                    key={bar.key}
                    feature="checklist.shiny"
                    label={t('checklist.status.shiny')}
                  >
                    {row}
                  </ProGate>
                ) : (
                  row
                );
              })}
            </Card>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={t('checklist.searchPlaceholder')}
            />
            <View style={styles.wrap}>
              {CHECKLIST_FILTERS.map((key) => (
                <Chip
                  key={key}
                  label={t(`checklist.filters.${key}`)}
                  selected={filter === key}
                  onPress={() =>
                    key === 'missing-shiny'
                      ? requirePro('checklist.shiny', () => setFilter(key))
                      : setFilter(key)
                  }
                />
              ))}
            </View>
            <ThemedText variant="caption" muted>
              {t('checklist.hint')}
            </ThemedText>
          </View>
        }
        ListEmptyComponent={dex.data ? <Message text={t('checklist.empty')} /> : <Loading />}
        renderItem={({ item: row }) =>
          row.type === 'header' ? (
            <View style={styles.groupHeader}>
              <ThemedText bold style={styles.flex}>
                {groupTitle(row.group)}
              </ThemedText>
              <ThemedText variant="caption" muted>
                {row.group.entries.filter((e) => (levels.get(e.pokemonId) ?? 0) >= 2).length}/
                {row.group.entries.length}
              </ThemedText>
              <Pressable
                onPress={() => setBatch(row.group)}
                accessibilityRole="button"
                accessibilityLabel={t('checklist.batchTitle', { group: groupTitle(row.group) })}
                hitSlop={8}
              >
                <Icon name="dots-horizontal" color={theme.colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <ChecklistItem
              entry={row.entry}
              level={levels.get(row.entry.pokemonId) ?? 0}
              onTap={onTap}
            />
          )
        }
      />
      <Sheet
        visible={batch !== null}
        title={batch ? t('checklist.batchTitle', { group: groupTitle(batch) }) : ''}
        onClose={() => setBatch(null)}
      >
        <View style={styles.batch}>
          {([3, 2, 1, 0] as const).map((level) => (
            <Button
              key={level}
              label={t(`checklist.markAs.${LEVEL_NAMES[level]}`)}
              color={level === 0 ? theme.colors.surfaceVariant : undefined}
              textColor={level === 0 ? theme.colors.text : undefined}
              onPress={() => {
                const entries = batch?.entries ?? [];
                setBatch(null);
                const apply = () => mark(entries, (current) => batchLevel(current, level));
                if (level === 3) requirePro('checklist.shiny', apply);
                else apply();
              }}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const ChecklistItem = memo(function ChecklistItem({
  entry,
  level,
  onTap,
}: {
  entry: ChecklistDexEntry;
  level: ChecklistLevel;
  onTap: (entry: ChecklistDexEntry, current: ChecklistLevel, tapped: 1 | 2 | 3) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const colors = [theme.colors.textMuted, theme.colors.primary, theme.colors.warning];
  return (
    <View style={[styles.row, { backgroundColor: theme.colors.surface }]}>
      <Pressable
        onPress={() => router.push(`/pokemon/${entry.pokemonId}`)}
        accessibilityRole="button"
        accessibilityLabel={entry.name}
        style={styles.identity}
      >
        <PokemonSprite pokemonId={entry.pokemonId} style="pixel" shiny={level === 3} size={40} />
        <View style={styles.flex}>
          <ThemedText variant="caption" muted>
            {dexNumber(entry.number)}
          </ThemedText>
          <ThemedText bold numberOfLines={1}>
            {entry.name}
          </ThemedText>
        </View>
      </Pressable>
      {MARKS.map((markDef, index) => {
        const active = level >= markDef.level;
        return (
          <Pressable
            key={markDef.key}
            onPress={() => onTap(entry, level, markDef.level)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`${entry.name}: ${t(`checklist.status.${markDef.key}`)}`}
            hitSlop={6}
            style={styles.mark}
          >
            <Icon
              name={markDef.icon}
              size={22}
              color={active ? colors[index] : theme.colors.border}
            />
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  header: { gap: SPACING.sm, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  barLabel: { width: 76 },
  barValue: { width: 112, textAlign: 'right' },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADII.md,
  },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  mark: { padding: SPACING.xs },
  batch: { gap: SPACING.sm },
});
