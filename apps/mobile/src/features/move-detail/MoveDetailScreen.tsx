import { FlashList } from '@shopify/flash-list';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getMoveDetail, getMoveLearners, type LearnTab, type MoveDetail } from '@thedex/db';
import { SPACING, type TypeAccent } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { FavoriteButton } from '../../entities/favorite/FavoriteButton';
import { DamageClassBadge } from '../../entities/move/DamageClassBadge';
import {
  formatMoveValue,
  formatPriority,
  learnersByTab,
  type LearnerEntry,
} from '../../entities/move/move-format';
import { PokemonRow } from '../../entities/pokemon/PokemonRow';
import { TypeBadge } from '../../entities/pokemon/TypeBadge';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import type { SectionRow } from '../../shared/sections';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { StatTiles } from '../../shared/ui/LinkRow';
import { Button, Loading, Message, ThemedText } from '../../shared/ui/primitives';
import { TabBar } from '../../shared/ui/TabBar';
import { MoveInfo } from './MoveInfo';

const TABS = ['info', 'learners'] as const;
type MoveTab = (typeof TABS)[number];
type LearnerRow = SectionRow<LearnTab, LearnerEntry>;

/** RF03.2–RF03.4: a move in the selected game, and who learns it (RF03.3). */
export function MoveDetailScreen({ moveId }: { moveId: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx, features } = useGame();
  const detail = useAsync(() => getMoveDetail(db, moveId, ctx), [db, ctx, moveId]);
  const learners = useAsync(() => getMoveLearners(db, moveId, ctx), [db, ctx, moveId]);
  const [tab, setTab] = useState<MoveTab>('info');
  const move = detail.data && detail.data.id === moveId ? detail.data : null;
  const accent = useTypeAccent(move?.stats?.type);

  const rows = useMemo(
    (): LearnerRow[] =>
      learnersByTab(learners.data ?? []).flatMap(([learnTab, entries]): LearnerRow[] => [
        { type: 'header', key: `header:${learnTab}`, header: learnTab },
        ...entries.map((entry) => ({
          type: 'item' as const,
          key: `${learnTab}:${entry.learner.pokemonId}`,
          item: entry,
        })),
      ]),
    [learners.data],
  );

  const screenOptions = {
    title: move?.name ?? '',
    headerStyle: { backgroundColor: accent.tint },
    headerTintColor: accent.text,
    headerShadowVisible: false,
    headerRight: () => <FavoriteButton entityType="move" entityId={moveId} color={accent.text} />,
  };

  if (detail.error) {
    return (
      <Message
        text={t('common.error', { message: detail.error.message })}
        action={<Button label={t('common.retry')} onPress={detail.reload} />}
      />
    );
  }
  if (!move) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={screenOptions} />
        {detail.loading ? <Loading /> : <Message text={t('move.notFound')} />}
      </View>
    );
  }

  const learnerCount = learners.data?.length ?? 0;
  const header = (
    <View>
      <MoveHeader move={move} accent={accent} />
      <TabBar
        tabs={TABS.map((key) => ({
          key,
          label:
            key === 'learners' && learners.data
              ? `${t('move.tabs.learners')} (${learnerCount})`
              : t(`move.tabs.${key}`),
        }))}
        active={tab}
        onChange={setTab}
        accent={accent}
      />
      <View style={styles.content}>
        {tab === 'info' ? <MoveInfo move={move} accent={accent} /> : null}
        {tab === 'learners' && !learners.data ? <Loading /> : null}
        {tab === 'learners' && learners.data && learnerCount === 0 ? (
          <ThemedText muted>
            {features.hasLearnsets ? t('move.learners.none') : t('move.learners.noData')}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={screenOptions} />
      <FlashList
        data={tab === 'learners' ? rows : []}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.type}
        ListHeaderComponent={header}
        renderItem={({ item: row }) =>
          row.type === 'header' ? (
            <ThemedText variant="caption" bold muted style={styles.sectionHeader}>
              {t(`profile.moves.tabs.${row.header}`)}
            </ThemedText>
          ) : (
            <View style={styles.rowWrap}>
              <PokemonRow
                pokemonId={row.item.learner.pokemonId}
                speciesId={row.item.learner.speciesId}
                name={row.item.learner.name}
                types={row.item.learner.types}
                dimmed={!row.item.learner.inGame}
                right={
                  row.item.levels.length > 0 ? (
                    <ThemedText bold color={accent.text}>
                      {t('move.learners.levels', {
                        levels: row.item.levels.map((level) => level || '—').join(', '),
                      })}
                    </ThemedText>
                  ) : null
                }
              />
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

function MoveHeader({ move, accent }: { move: MoveDetail; accent: TypeAccent }) {
  const { t } = useTranslation();
  const { typeName } = useCatalog();
  const stats = move.stats;
  return (
    <View style={[styles.header, { backgroundColor: accent.tint }]}>
      {stats ? (
        <View style={styles.badges}>
          <TypeBadge type={stats.type} name={typeName(stats.type)} />
          <DamageClassBadge damageClass={stats.damageClass} />
        </View>
      ) : null}
      {stats ? (
        <StatTiles
          color={accent.text}
          items={[
            { label: t('move.power'), value: formatMoveValue(stats.power) },
            {
              label: t('move.accuracy'),
              value: stats.accuracy === null ? '—' : `${stats.accuracy}%`,
            },
            {
              label: t('move.pp'),
              value: formatMoveValue(stats.pp),
              detail: stats.maxPp === null ? undefined : t('move.ppMax', { max: stats.maxPp }),
            },
            { label: t('move.priority'), value: formatPriority(stats.priority) },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { padding: SPACING.lg, gap: SPACING.md },
  badges: { flexDirection: 'row', gap: SPACING.sm },
  content: { padding: SPACING.lg },
  sectionHeader: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  rowWrap: { paddingHorizontal: SPACING.lg },
  listContent: { paddingBottom: SPACING.xxl },
});
