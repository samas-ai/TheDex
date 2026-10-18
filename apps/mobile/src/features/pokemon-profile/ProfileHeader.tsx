import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PokemonProfile } from '@thedex/db';
import { SPACING, type TypeAccent } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { PokemonSprite } from '../../entities/pokemon/PokemonSprite';
import { TypeBadge } from '../../entities/pokemon/TypeBadge';
import { dexNumber } from '../../shared/format';
import { useGame } from '../../shared/game/GameProvider';
import { useSettings } from '../../shared/settings/SettingsProvider';
import { Chip, ThemedText } from '../../shared/ui/primitives';
import { CryButton } from './CryButton';

/** RF02.1: name, numbers, genus, types, normal/shiny sprite toggle and cry. */
export function ProfileHeader({
  profile,
  accent,
  shiny,
  onToggleShiny,
}: {
  profile: PokemonProfile;
  accent: TypeAccent;
  shiny: boolean;
  onToggleShiny: () => void;
}) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { ctx, game } = useGame();
  const { typeName } = useCatalog();
  return (
    <View style={[styles.header, { backgroundColor: accent.tint }]}>
      {!profile.inGame ? (
        <ThemedText variant="small" color={accent.text} style={styles.banner}>
          {t('profile.notInGame', { game: game.name })}
        </ThemedText>
      ) : null}
      <PokemonSprite pokemonId={profile.id} style={settings.spriteStyle} shiny={shiny} size={200} />
      <ThemedText variant="caption" muted>
        {t('profile.national', { number: dexNumber(profile.nationalNumber).slice(1) })}
        {profile.regionalNumber !== null
          ? ` · ${t('profile.regional', { number: dexNumber(profile.regionalNumber).slice(1) })}`
          : ''}
      </ThemedText>
      <ThemedText variant="display">{profile.name}</ThemedText>
      {profile.genus ? <ThemedText muted>{profile.genus}</ThemedText> : null}
      {profile.formName ? (
        <ThemedText variant="small" muted>
          {t('profile.about.formName', { name: profile.formName })}
        </ThemedText>
      ) : null}
      <View style={styles.types}>
        {profile.types.map((type) => (
          <TypeBadge key={type} type={type} name={typeName(type)} />
        ))}
      </View>
      <View style={styles.actions}>
        <Chip
          label={shiny ? `✦ ${t('profile.shiny')}` : t('profile.normal')}
          selected={shiny}
          selectedColor={accent.base}
          selectedTextColor={accent.onBase}
          onPress={onToggleShiny}
        />
        <CryButton pokemonId={profile.id} generationId={ctx.generationId} accent={accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    gap: 2,
  },
  banner: { textAlign: 'center', marginBottom: SPACING.sm },
  types: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  actions: { flexDirection: 'row', marginTop: SPACING.md },
});
