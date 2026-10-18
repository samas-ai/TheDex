import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  getAbilityDetail,
  getFlavorTexts,
  type PokemonAbility,
  type PokemonProfile,
} from '@thedex/db';
import { SPACING, type TypeAccent } from '@thedex/ui-tokens';
import { useCatalog } from '../../../entities/catalog/CatalogProvider';
import { useAppDatabase } from '../../../shared/db/DatabaseProvider';
import {
  capitalize,
  formatHeight,
  formatPercent,
  formatWeight,
  genderRatio,
} from '../../../shared/format';
import { useGame } from '../../../shared/game/GameProvider';
import { useAsync } from '../../../shared/hooks/useAsync';
import { useTheme } from '../../../shared/theme/ThemeProvider';
import { Sheet } from '../../../shared/ui/Sheet';
import {
  Button,
  Card,
  Chip,
  InfoRow,
  Loading,
  Section,
  styles as ui,
  ThemedText,
} from '../../../shared/ui/primitives';

/** RF02.2: Pokédex entries, measurements, abilities, training and breeding data. */
export function AboutTab({ profile, accent }: { profile: PokemonProfile; accent: TypeAccent }) {
  const { t } = useTranslation();
  const { statName } = useCatalog();
  const [ability, setAbility] = useState<PokemonAbility | null>(null);
  const height = formatHeight(profile.heightDm);
  const weight = formatWeight(profile.weightHg);
  const gender = genderRatio(profile.species.genderRate);
  const evYield = profile.evYield
    ? (
        [
          ['hp', profile.evYield.hp],
          ['attack', profile.evYield.attack],
          ['defense', profile.evYield.defense],
          ['special-attack', profile.evYield.specialAttack],
          ['special-defense', profile.evYield.specialDefense],
          ['speed', profile.evYield.speed],
        ] as const
      )
        .filter(([, value]) => value > 0)
        .map(([stat, value]) => `${value} ${statName(stat)}`)
        .join(', ')
    : null;

  return (
    <View>
      <FlavorTextSection speciesId={profile.speciesId} accent={accent} />

      <Section title={t('profile.about.abilities')}>
        {profile.abilities.length === 0 ? (
          <ThemedText muted>{t('profile.about.noAbilities')}</ThemedText>
        ) : (
          <Card>
            {profile.abilities.map((entry) => (
              <Pressable
                key={`${entry.slot}-${entry.id}`}
                onPress={() => setAbility(entry)}
                accessibilityRole="button"
                style={styles.abilityRow}
              >
                <ThemedText bold color={accent.text}>
                  {entry.name}
                </ThemedText>
                {entry.isHidden ? (
                  <ThemedText variant="caption" muted>
                    {t('profile.about.hidden')}
                  </ThemedText>
                ) : null}
                <ThemedText muted style={styles.chevron}>
                  ›
                </ThemedText>
              </Pressable>
            ))}
          </Card>
        )}
      </Section>

      <Section title={t('profile.about.training')}>
        <Card>
          <InfoRow
            label={t('profile.about.height')}
            value={`${t('units.meters', { value: height.meters })} (${t('units.feet', height)})`}
          />
          <InfoRow
            label={t('profile.about.weight')}
            value={`${t('units.kilograms', { value: weight.kilograms })} (${t('units.pounds', { value: weight.pounds })})`}
          />
          {evYield !== null ? (
            <InfoRow label={t('profile.about.evYield')} value={evYield || t('common.none')} />
          ) : null}
          <InfoRow label={t('profile.about.catchRate')} value={profile.species.captureRate} />
          {profile.species.baseHappiness !== null ? (
            <InfoRow
              label={t('profile.about.baseFriendship')}
              value={profile.species.baseHappiness}
            />
          ) : null}
          {profile.baseExperience !== null ? (
            <InfoRow label={t('profile.about.baseExp')} value={profile.baseExperience} />
          ) : null}
          <InfoRow
            label={t('profile.about.growthRate')}
            value={capitalize(profile.species.growthRate.name)}
          />
        </Card>
      </Section>

      <Section title={t('profile.about.breeding')}>
        <Card>
          <InfoRow
            label={t('profile.about.gender')}
            value={
              gender
                ? t('profile.about.genderRatio', {
                    female: formatPercent(gender.female),
                    male: formatPercent(gender.male),
                  })
                : t('profile.about.genderless')
            }
          />
          <InfoRow
            label={t('profile.about.eggGroups')}
            value={profile.species.eggGroups.map((group) => group.name).join(', ') || '—'}
          />
          {profile.species.hatchCounter !== null ? (
            <InfoRow label={t('profile.about.eggCycles')} value={profile.species.hatchCounter} />
          ) : null}
        </Card>
      </Section>

      <AbilitySheet ability={ability} accent={accent} onClose={() => setAbility(null)} />
    </View>
  );
}

function FlavorTextSection({ speciesId, accent }: { speciesId: number; accent: TypeAccent }) {
  const { t } = useTranslation();
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const { data } = useAsync(() => getFlavorTexts(db, speciesId, ctx), [db, speciesId, ctx]);
  const [selected, setSelected] = useState<number | null>(null);

  const { shown, fallback } = useMemo(() => {
    const entries = data ?? [];
    const inGame = entries.filter((entry) => entry.inGame);
    return inGame.length > 0
      ? { shown: inGame, fallback: false }
      : { shown: entries.slice(-1), fallback: entries.length > 0 };
  }, [data]);
  const current = shown.find((entry) => entry.versionId === selected) ?? shown[0];

  return (
    <Section title={t('profile.about.dexEntry')}>
      {!data ? (
        <Loading />
      ) : !current ? (
        <ThemedText muted>{t('profile.about.noEntries')}</ThemedText>
      ) : (
        <Card>
          {shown.length > 1 ? (
            <View style={ui.wrap}>
              {shown.map((entry) => (
                <Chip
                  key={entry.versionId}
                  label={entry.versionName}
                  selected={entry.versionId === current.versionId}
                  selectedColor={accent.base}
                  selectedTextColor={accent.onBase}
                  onPress={() => setSelected(entry.versionId)}
                />
              ))}
            </View>
          ) : null}
          {fallback ? (
            <ThemedText variant="caption" muted>
              {t('profile.about.otherGame', { version: current.versionName })}
            </ThemedText>
          ) : null}
          <ThemedText>{current.text}</ThemedText>
        </Card>
      )}
    </Section>
  );
}

function AbilitySheet({
  ability,
  accent,
  onClose,
}: {
  ability: PokemonAbility | null;
  accent: TypeAccent;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const { data, loading } = useAsync(
    async () => (ability ? getAbilityDetail(db, ability.id, ctx) : null),
    [db, ctx, ability?.id],
  );
  const detail = data && ability && data.id === ability.id ? data : null;
  return (
    <Sheet visible={ability !== null} title={ability?.name ?? ''} onClose={onClose}>
      {loading && !detail ? (
        <Loading />
      ) : detail ? (
        <View style={styles.sheetBody}>
          {ability?.isHidden ? (
            <ThemedText variant="small" color={accent.text}>
              {t('profile.about.hidden')}
            </ThemedText>
          ) : null}
          {detail.flavorText ? (
            <Section title={t('profile.ability.inGame')}>
              <ThemedText>{detail.flavorText}</ThemedText>
            </Section>
          ) : null}
          {detail.effect || detail.shortEffect ? (
            <Section title={t('profile.ability.effect')}>
              <ThemedText>{detail.effect ?? detail.shortEffect}</ThemedText>
            </Section>
          ) : null}
          {detail.overworldEffect ? (
            <Section title={t('profile.ability.overworld')}>
              <ThemedText>{detail.overworldEffect}</ThemedText>
            </Section>
          ) : null}
          <ThemedText variant="caption" color={theme.colors.textMuted}>
            {t('profile.ability.introduced', { number: detail.generationId })}
          </ThemedText>
          <Button
            label={t('profile.ability.open')}
            onPress={() => {
              onClose();
              router.push(`/ability/${detail.id}`);
            }}
            color={accent.base}
            textColor={accent.onBase}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  abilityRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minHeight: 36 },
  chevron: { marginLeft: 'auto' },
  sheetBody: { gap: SPACING.sm },
});
