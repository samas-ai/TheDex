import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  getEvolutionChain,
  getPokemonForms,
  type EvolutionNode,
  type PokemonProfile,
} from '@thedex/db';
import { RADII, SPACING, type TypeAccent } from '@thedex/ui-tokens';
import { useCatalog } from '../../../entities/catalog/CatalogProvider';
import { PokemonSprite } from '../../../entities/pokemon/PokemonSprite';
import { TypeBadge } from '../../../entities/pokemon/TypeBadge';
import { useAppDatabase } from '../../../shared/db/DatabaseProvider';
import { useGame } from '../../../shared/game/GameProvider';
import { useAsync } from '../../../shared/hooks/useAsync';
import { useSettings } from '../../../shared/settings/SettingsProvider';
import { useTheme } from '../../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../../shared/theme/useTypeAccent';
import {
  Card,
  Chip,
  Loading,
  Section,
  styles as ui,
  ThemedText,
} from '../../../shared/ui/primitives';
import { describeEvolutionMethod, evolutionStages, type Translate } from '../profile-logic';

const FORM_KINDS = [
  'default',
  'mega',
  'primal',
  'gmax',
  'regional_alola',
  'regional_galar',
  'regional_hisui',
  'regional_paldea',
  'totem',
  'battle',
  'item',
  'cosmetic',
  'other',
] as const;
type KnownFormKind = (typeof FORM_KINDS)[number];
const knownKind = (kind: string): KnownFormKind =>
  (FORM_KINDS as readonly string[]).includes(kind) ? (kind as KnownFormKind) : 'other';

/** RF02.5: clickable evolution tree with exact methods, plus alternate and cosmetic forms. */
export function EvolutionTab({ profile, accent }: { profile: PokemonProfile; accent: TypeAccent }) {
  const { t } = useTranslation();
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const { typeName } = useCatalog();
  const { data } = useAsync(
    async () => ({
      chain: await getEvolutionChain(db, profile.speciesId, ctx),
      forms: await getPokemonForms(db, profile.id, ctx),
    }),
    [db, ctx, profile.id, profile.speciesId],
  );
  if (!data) return <Loading />;
  const stages = data.chain ? evolutionStages(data.chain.nodes) : [];
  const varieties = data.forms.varieties.filter(
    (variety) => variety.inGame || variety.pokemonId === profile.id,
  );

  return (
    <View>
      <Section title={t('profile.tabs.evolution')}>
        {stages.length <= 1 ? (
          <ThemedText muted>{t('profile.evolution.noEvolution')}</ThemedText>
        ) : (
          <Card>
            {stages.map((stage, index) => (
              <View key={index} style={styles.stage}>
                {stage.map((node) => (
                  <EvolutionCard
                    key={node.speciesId}
                    node={node}
                    current={node.speciesId === profile.speciesId}
                    showMethods={index > 0}
                    t={t as Translate}
                  />
                ))}
              </View>
            ))}
          </Card>
        )}
      </Section>

      {varieties.length > 1 ? (
        <Section title={t('profile.evolution.forms')}>
          <Card>
            {varieties.map((variety) => (
              <Pressable
                key={variety.pokemonId}
                onPress={() =>
                  variety.pokemonId !== profile.id && router.push(`/pokemon/${variety.pokemonId}`)
                }
                accessibilityRole="button"
                style={styles.formRow}
              >
                <PokemonSprite pokemonId={variety.pokemonId} style="pixel" size={48} />
                <View style={styles.flex}>
                  <ThemedText
                    bold
                    color={variety.pokemonId === profile.id ? accent.text : undefined}
                  >
                    {variety.name}
                  </ThemedText>
                  <ThemedText variant="caption" muted>
                    {t(`profile.evolution.formKinds.${knownKind(variety.formKind)}`)}
                    {variety.change?.item
                      ? ` · ${t('profile.evolution.changeItem', { item: variety.change.item.name })}`
                      : ''}
                  </ThemedText>
                </View>
                <View style={styles.formTypes}>
                  {variety.types.map((type) => (
                    <TypeBadge key={type} type={type} name={typeName(type)} size="sm" />
                  ))}
                </View>
              </Pressable>
            ))}
          </Card>
        </Section>
      ) : null}

      {data.forms.cosmeticForms.length > 0 ? (
        <Section title={t('profile.evolution.cosmetic')}>
          <View style={ui.wrap}>
            {data.forms.cosmeticForms.map((form) => (
              <Chip
                key={form.formId}
                label={form.name}
                selected={form.isDefault}
                selectedColor={accent.base}
                selectedTextColor={accent.onBase}
              />
            ))}
          </View>
        </Section>
      ) : null}
    </View>
  );
}

function EvolutionCard({
  node,
  current,
  showMethods,
  t,
}: {
  node: EvolutionNode;
  current: boolean;
  showMethods: boolean;
  t: Translate;
}) {
  const theme = useTheme();
  const { settings } = useSettings();
  const accent = useTypeAccent(node.types[0]);
  return (
    <Pressable
      onPress={() => !current && router.push(`/pokemon/${node.pokemonId}`)}
      accessibilityRole="button"
      style={[
        styles.node,
        {
          backgroundColor: current ? accent.tint : theme.colors.surfaceVariant,
          borderColor: current ? accent.base : 'transparent',
          opacity: node.inGame ? 1 : 0.55,
        },
      ]}
    >
      {showMethods
        ? node.methods.map((method, index) => (
            <ThemedText key={index} variant="caption" color={accent.text} style={styles.method}>
              ↓ {describeEvolutionMethod(method, t)}
            </ThemedText>
          ))
        : null}
      <PokemonSprite pokemonId={node.pokemonId} style={settings.spriteStyle} size={72} />
      <ThemedText bold>{node.name}</ThemedText>
      {!node.inGame ? (
        <ThemedText variant="caption" muted>
          {t('profile.evolution.allGames')}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stage: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: SPACING.sm },
  node: {
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADII.md,
    borderWidth: 2,
    minWidth: 120,
    maxWidth: 200,
    gap: 2,
  },
  method: { textAlign: 'center' },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 52 },
  formTypes: { flexDirection: 'row', gap: SPACING.xs },
});
