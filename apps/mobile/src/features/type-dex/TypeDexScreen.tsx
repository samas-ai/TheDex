import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { listMoves, listPokedex, type MoveListEntry, type PokedexEntry } from '@thedex/db';
import { SPACING, typeAccent } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { MoveRow } from '../../entities/move/MoveRow';
import { PokemonRow } from '../../entities/pokemon/PokemonRow';
import { MatchupGroups } from '../../entities/type/MatchupGroups';
import {
  defensiveGroups,
  offensiveGroups,
  toggleTypePair,
} from '../../entities/type/type-matchups';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { Card, Chip, Loading, Section, styles as ui, ThemedText } from '../../shared/ui/primitives';
import { TabBar } from '../../shared/ui/TabBar';
import { TypeChart } from './TypeChart';

const TABS = ['matchups', 'pokemon', 'moves', 'chart'] as const;
type TypeTab = (typeof TABS)[number];

type Row =
  | { readonly kind: 'pokemon'; readonly key: string; readonly entry: PokedexEntry }
  | { readonly kind: 'move'; readonly key: string; readonly move: MoveListEntry };

/**
 * RF07.1: pick one or two types to see what they hit and what hits them in the selected
 * game's generation, the Pokémon with that typing and the moves of those types.
 */
export function TypeDexScreen({ initialTypeId }: { initialTypeId?: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx, features } = useGame();
  const { types } = useCatalog();
  const [selected, setSelected] = useState<readonly number[]>(() =>
    initialTypeId !== undefined && types.some((type) => type.id === initialTypeId)
      ? [initialTypeId]
      : [],
  );
  const [tab, setTab] = useState<TypeTab>('matchups');
  const identifiers = selected
    .map((id) => types.find((type) => type.id === id)?.identifier)
    .filter((identifier): identifier is string => identifier !== undefined);
  const accent = useTypeAccent(identifiers[0]);

  const pokemon = useAsync(
    async () =>
      selected.length === 0 || tab !== 'pokemon'
        ? null
        : listPokedex(db, ctx, { filters: { typeIds: selected } }),
    [db, ctx, selected, tab],
  );
  const moves = useAsync(
    async () =>
      selected.length === 0 || tab !== 'moves'
        ? null
        : listMoves(db, ctx, {
            filters: { typeIds: selected, learnableOnly: features.hasLearnsets },
          }),
    [db, ctx, selected, tab, features.hasLearnsets],
  );

  const rows = useMemo((): Row[] => {
    if (tab === 'pokemon') {
      return (pokemon.data ?? []).map((entry) => ({
        kind: 'pokemon',
        key: `p${entry.id}`,
        entry,
      }));
    }
    if (tab === 'moves') {
      return (moves.data ?? []).map((move) => ({ kind: 'move', key: `m${move.id}`, move }));
    }
    return [];
  }, [tab, pokemon.data, moves.data]);
  const openMove = useCallback((moveId: number) => router.push(`/move/${moveId}`), []);

  const header = (
    <View>
      <View style={styles.picker}>
        <ThemedText variant="caption" muted style={styles.hint}>
          {t('typeDex.pick')}
        </ThemedText>
        <View style={ui.wrap}>
          {types.map((type) => {
            const color = typeAccent(type.identifier, theme);
            return (
              <Chip
                key={type.id}
                label={type.name}
                selected={selected.includes(type.id)}
                selectedColor={color.base}
                selectedTextColor={color.onBase}
                onPress={() => setSelected((current) => toggleTypePair(current, type.id))}
              />
            );
          })}
        </View>
      </View>
      <TabBar
        tabs={TABS.map((key) => ({
          key,
          label:
            key === 'pokemon' && pokemon.data
              ? `${t('typeDex.tabs.pokemon')} (${pokemon.data.length})`
              : key === 'moves' && moves.data
                ? `${t('typeDex.tabs.moves')} (${moves.data.length})`
                : t(`typeDex.tabs.${key}`),
        }))}
        active={tab}
        onChange={setTab}
        accent={accent}
      />
      <View style={styles.content}>
        {tab === 'chart' ? (
          <TypeChart generationId={ctx.generationId} highlight={identifiers} />
        ) : identifiers.length === 0 ? (
          <ThemedText muted>{t('typeDex.pick')}</ThemedText>
        ) : tab === 'matchups' ? (
          <>
            <Section title={t('typeDex.offense')}>
              <Card>
                <ThemedText variant="caption" muted>
                  {t('typeDex.offenseNote')}
                </ThemedText>
                <MatchupGroups groups={offensiveGroups(identifiers, ctx.generationId)} />
              </Card>
            </Section>
            <Section title={t('typeDex.defense')}>
              <Card>
                <ThemedText variant="caption" muted>
                  {t('typeDex.defenseNote')}
                </ThemedText>
                <MatchupGroups groups={defensiveGroups(identifiers, ctx.generationId)} />
              </Card>
            </Section>
          </>
        ) : tab === 'pokemon' ? (
          !pokemon.data ? (
            <Loading />
          ) : pokemon.data.length === 0 ? (
            <ThemedText muted>{t('typeDex.noPokemon')}</ThemedText>
          ) : null
        ) : !moves.data ? (
          <Loading />
        ) : moves.data.length === 0 ? (
          <ThemedText muted>{t('typeDex.noMoves')}</ThemedText>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: t('nav.types') }} />
      <FlashList
        data={rows}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.kind}
        ListHeaderComponent={header}
        renderItem={({ item: row }) => (
          <View style={styles.rowWrap}>
            {row.kind === 'pokemon' ? (
              <PokemonRow
                pokemonId={row.entry.id}
                speciesId={row.entry.speciesId}
                name={row.entry.name}
                types={row.entry.types}
              />
            ) : (
              <MoveRow move={row.move} onPress={openMove} />
            )}
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  picker: { padding: SPACING.lg, paddingBottom: SPACING.sm },
  hint: { marginBottom: SPACING.sm },
  content: { padding: SPACING.lg },
  rowWrap: { paddingHorizontal: SPACING.lg },
  listContent: { paddingBottom: SPACING.xxl },
});
