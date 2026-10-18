import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getPokemonMoves, type LearnsetMove, type LearnTab, type PokemonProfile } from '@thedex/db';
import { DAMAGE_CLASS_COLORS, SPACING, type TypeAccent } from '@thedex/ui-tokens';
import { useCatalog } from '../../../entities/catalog/CatalogProvider';
import { TypeBadge } from '../../../entities/pokemon/TypeBadge';
import { useAppDatabase } from '../../../shared/db/DatabaseProvider';
import { useGame } from '../../../shared/game/GameProvider';
import { useAsync } from '../../../shared/hooks/useAsync';
import { useTheme } from '../../../shared/theme/ThemeProvider';
import { Card, Chip, Loading, styles as ui, ThemedText } from '../../../shared/ui/primitives';
import { movesByTab } from '../profile-logic';

const DAMAGE_CLASSES = new Set(Object.keys(DAMAGE_CLASS_COLORS));

/** RF02.6: moves of the selected game by level, TM/HM/TR, egg, tutor and evolution. */
export function MovesTab({ profile, accent }: { profile: PokemonProfile; accent: TypeAccent }) {
  const { t } = useTranslation();
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const { data } = useAsync(() => getPokemonMoves(db, profile.id, ctx), [db, ctx, profile.id]);
  const [tab, setTab] = useState<LearnTab | null>(null);
  if (!data) return <Loading />;
  const tabs = movesByTab(data.moves);
  if (tabs.length === 0) return <ThemedText muted>{t('profile.moves.none')}</ThemedText>;
  const [activeTab, moves] = tabs.find(([key]) => key === tab) ?? tabs[0]!;

  return (
    <View style={styles.root}>
      {data.inheritedFromPokemonId !== null ? (
        <ThemedText variant="caption" muted>
          {t('profile.moves.inherited')}
        </ThemedText>
      ) : null}
      <View style={ui.wrap}>
        {tabs.map(([key, list]) => (
          <Chip
            key={key}
            label={`${t(`profile.moves.tabs.${key}`)} (${list.length})`}
            selected={key === activeTab}
            selectedColor={accent.base}
            selectedTextColor={accent.onBase}
            onPress={() => setTab(key)}
          />
        ))}
      </View>
      <Card style={styles.card}>
        {moves.map((move) => (
          <MoveRow key={`${move.method}-${move.level}-${move.moveId}`} move={move} />
        ))}
      </Card>
    </View>
  );
}

function MoveRow({ move }: { move: LearnsetMove }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { typeName } = useCatalog();
  const lead =
    move.tab === 'level-up'
      ? `${t('profile.moves.levelShort')} ${move.level}`
      : move.tab === 'evolution'
        ? t('profile.moves.evolutionShort')
        : move.tab === 'machine'
          ? (move.machine ?? '—')
          : null;
  const classColor =
    move.damageClass && DAMAGE_CLASSES.has(move.damageClass)
      ? DAMAGE_CLASS_COLORS[move.damageClass as keyof typeof DAMAGE_CLASS_COLORS]
      : theme.colors.border;
  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
      {lead !== null ? (
        <ThemedText variant="caption" muted style={styles.lead}>
          {lead}
        </ThemedText>
      ) : null}
      <View style={styles.name}>
        <ThemedText bold numberOfLines={1}>
          {move.name}
        </ThemedText>
        <View style={styles.meta}>
          {move.type ? <TypeBadge type={move.type} name={typeName(move.type)} size="sm" /> : null}
          <View style={[styles.classDot, { backgroundColor: classColor }]} />
          <ThemedText variant="caption" muted>
            {`${t('profile.moves.power')} ${move.power ?? '—'} · ${t('profile.moves.accuracy')} ${move.accuracy ?? '—'} · ${t('profile.moves.pp')} ${move.pp ?? '—'}`}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACING.sm },
  card: { paddingVertical: SPACING.xs, gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lead: { width: 48 },
  name: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  classDot: { width: 8, height: 8, borderRadius: 4 },
});
