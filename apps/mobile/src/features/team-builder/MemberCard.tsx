import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TeamMember } from '@thedex/db';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { PokemonSprite } from '../../entities/pokemon/PokemonSprite';
import { TypeBadge } from '../../entities/pokemon/TypeBadge';
import { useSettings } from '../../shared/settings/SettingsProvider';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { Icon } from '../../shared/ui/Icon';
import { ThemedText } from '../../shared/ui/primitives';
import type { TeamDetails } from './useTeamDetails';

/** A filled team slot (RF08.2 summary): sprite, typing, Tera Type, item, ability and moves. */
export function MemberCard({
  member,
  details,
  onPress,
}: {
  member: TeamMember;
  details: TeamDetails | undefined;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { settings } = useSettings();
  const { typeName } = useCatalog();
  const variety = details?.pokemon.get(member.pokemonId);
  const accent = useTypeAccent(variety?.types[0]);
  const name = variety?.name ?? '…';
  const ability = variety?.abilities.find((a) => a.id === member.abilityId)?.name;
  const item = member.itemId === null ? null : details?.items.get(member.itemId);
  const moves = member.moveIds
    .filter((id): id is number => id !== null)
    .map((id) => details?.moves.get(id));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={member.nickname ? `${member.nickname} (${name})` : name}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? accent.tint : theme.colors.surface,
          borderLeftColor: accent.base,
        },
      ]}
    >
      <PokemonSprite
        pokemonId={member.pokemonId}
        style={settings.spriteStyle}
        shiny={member.shiny}
        size={72}
      />
      <View style={styles.body}>
        <View style={styles.line}>
          <ThemedText bold numberOfLines={1} style={styles.shrink}>
            {member.nickname ? `${member.nickname} (${name})` : name}
          </ThemedText>
          {member.shiny ? <Icon name="star-four-points" size={14} color={accent.text} /> : null}
          <ThemedText variant="caption" muted>
            {t('teamEditor.level', { level: member.level })}
          </ThemedText>
        </View>
        <View style={styles.line}>
          {variety?.types.map((type) => (
            <TypeBadge key={type} type={type} name={typeName(type)} size="sm" />
          ))}
          {member.teraType ? (
            <ThemedText variant="caption" muted>
              {t('teamEditor.teraShort', {
                type: member.teraType === 'stellar' ? t('slot.stellar') : typeName(member.teraType),
              })}
            </ThemedText>
          ) : null}
        </View>
        {item || ability ? (
          <ThemedText variant="caption" muted numberOfLines={1}>
            {[item, ability].filter(Boolean).join(' · ')}
          </ThemedText>
        ) : null}
        {moves.length > 0 ? (
          <ThemedText variant="small" numberOfLines={2}>
            {moves.map((move) => move?.name ?? '…').join(' · ')}
          </ThemedText>
        ) : (
          <ThemedText variant="caption" muted>
            {t('teamEditor.noMoves')}
          </ThemedText>
        )}
        {variety && variety.stats === null ? (
          <ThemedText variant="caption" color={theme.colors.warning}>
            {t('teamEditor.notInGeneration')}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** An empty slot: opens the Pokémon picker. */
export function EmptySlot({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('teamEditor.addPokemon')}
      style={({ pressed }) => [
        styles.empty,
        { borderColor: theme.colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Icon name="plus" color={theme.colors.textMuted} />
      <ThemedText muted>{t('teamEditor.addPokemon')}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADII.lg,
    borderLeftWidth: 4,
  },
  body: { flex: 1, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexWrap: 'wrap' },
  shrink: { flexShrink: 1 },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 64,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
