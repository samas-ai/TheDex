import { FlashList } from '@shopify/flash-list';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  getAbilityDetail,
  getAbilityHolders,
  type AbilityDetail,
  type AbilityHolder,
} from '@thedex/db';
import { SPACING } from '@thedex/ui-tokens';
import { FavoriteButton } from '../../entities/favorite/FavoriteButton';
import { PokemonRow } from '../../entities/pokemon/PokemonRow';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { toSectionRows, type SectionRow } from '../../shared/sections';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Button, Card, Loading, Message, Section, ThemedText } from '../../shared/ui/primitives';

const HOLDER_SECTIONS = ['regular', 'hidden', 'otherGames'] as const;
type HolderSection = (typeof HOLDER_SECTIONS)[number];

const sectionOf = (holder: AbilityHolder): HolderSection =>
  !holder.inGame ? 'otherGames' : holder.isHidden ? 'hidden' : 'regular';

/** RF04: an ability's effects in and out of battle, and who has it (regular / hidden). */
export function AbilityDetailScreen({ abilityId }: { abilityId: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const detail = useAsync(() => getAbilityDetail(db, abilityId, ctx), [db, ctx, abilityId]);
  const holders = useAsync(() => getAbilityHolders(db, abilityId, ctx), [db, ctx, abilityId]);
  const ability = detail.data && detail.data.id === abilityId ? detail.data : null;
  const rows = useMemo(
    (): SectionRow<HolderSection, AbilityHolder>[] =>
      toSectionRows(holders.data ?? [], HOLDER_SECTIONS, sectionOf, (holder) =>
        String(holder.pokemonId),
      ),
    [holders.data],
  );
  const counts = useMemo(() => {
    const bySection = new Map<HolderSection, number>();
    for (const holder of holders.data ?? []) {
      bySection.set(sectionOf(holder), (bySection.get(sectionOf(holder)) ?? 0) + 1);
    }
    return bySection;
  }, [holders.data]);

  if (detail.error) {
    return (
      <Message
        text={t('common.error', { message: detail.error.message })}
        action={<Button label={t('common.retry')} onPress={detail.reload} />}
      />
    );
  }
  if (!ability) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: '' }} />
        {detail.loading ? <Loading /> : <Message text={t('ability.notFound')} />}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen
        options={{
          title: ability.name,
          headerRight: () => <FavoriteButton entityType="ability" entityId={abilityId} />,
        }}
      />
      <FlashList
        data={rows}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.type}
        ListHeaderComponent={
          <AbilityInfo
            ability={ability}
            holdersLoaded={holders.data !== undefined}
            holderCount={holders.data?.length ?? 0}
          />
        }
        renderItem={({ item: row }) =>
          row.type === 'header' ? (
            <ThemedText variant="caption" bold muted style={styles.sectionHeader}>
              {`${t(`ability.${row.header}`)} (${counts.get(row.header) ?? 0})`}
            </ThemedText>
          ) : (
            <View style={styles.rowWrap}>
              <PokemonRow
                pokemonId={row.item.pokemonId}
                speciesId={row.item.speciesId}
                name={row.item.name}
                types={row.item.types}
                dimmed={!row.item.inGame}
              />
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

function AbilityInfo({
  ability,
  holdersLoaded,
  holderCount,
}: {
  ability: AbilityDetail;
  holdersLoaded: boolean;
  holderCount: number;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.content}>
      <ThemedText variant="caption" muted style={styles.introduced}>
        {t('ability.introduced', { number: ability.generationId })}
      </ThemedText>
      {ability.flavorText ? (
        <Section title={t('ability.inGame')}>
          <Card>
            <ThemedText>{ability.flavorText}</ThemedText>
          </Card>
        </Section>
      ) : null}
      {ability.effect || ability.shortEffect ? (
        <Section title={t('ability.effect')}>
          <Card>
            <ThemedText>{ability.effect ?? ability.shortEffect}</ThemedText>
          </Card>
        </Section>
      ) : null}
      {ability.overworldEffect ? (
        <Section title={t('ability.overworld')}>
          <Card>
            <ThemedText>{ability.overworldEffect}</ThemedText>
          </Card>
        </Section>
      ) : null}
      <ThemedText variant="title" bold>
        {t('ability.holders')}
      </ThemedText>
      {!holdersLoaded ? <Loading /> : null}
      {holdersLoaded && holderCount === 0 ? (
        <ThemedText muted>{t('ability.noHolders')}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xs },
  introduced: { marginBottom: SPACING.md },
  sectionHeader: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  rowWrap: { paddingHorizontal: SPACING.lg },
  listContent: { paddingBottom: SPACING.xxl },
});
