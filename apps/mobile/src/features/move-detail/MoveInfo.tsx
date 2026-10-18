import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MoveDetail } from '@thedex/db';
import { SPACING, type TypeAccent } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { ItemIcon } from '../../entities/item/ItemIcon';
import { describeMoveMeta, describeZBoosts, type Translate } from '../../entities/move/move-format';
import { useGame } from '../../shared/game/GameProvider';
import { LinkRow } from '../../shared/ui/LinkRow';
import { Card, InfoRow, Section, ThemedText } from '../../shared/ui/primitives';

const Z_EFFECTS = [
  'clearnegativeboost',
  'heal',
  'healreplacement',
  'crit2',
  'redirect',
  'curse',
] as const;
type ZEffect = (typeof Z_EFFECTS)[number];
const isZEffect = (value: string): value is ZEffect =>
  (Z_EFFECTS as readonly string[]).includes(value);

const openMove = (id: number) => router.push(`/move/${id}`);
const openItem = (id: number) => router.push(`/item/${id}`);
const openPokemon = (id: number) => router.push(`/pokemon/${id}`);

/** RF03.2 + RF03.4: effect, in-game text, battle details, properties, Z/Max/G-Max data. */
export function MoveInfo({ move, accent }: { move: MoveDetail; accent: TypeAccent }) {
  const { t } = useTranslation();
  const { game } = useGame();
  const { statName, typeName } = useCatalog();
  // Keys are built at runtime (`move.meta.<key>`), so the typed `t` is widened.
  const meta = move.meta ? describeMoveMeta(move.meta, t as Translate, statName) : [];
  const stats = move.stats;

  return (
    <View>
      {move.effect || move.shortEffect ? (
        <Section title={t('move.effect')}>
          <Card>
            <ThemedText>{move.effect ?? move.shortEffect}</ThemedText>
          </Card>
        </Section>
      ) : null}

      {move.flavorText ? (
        <Section title={t('move.inGame')}>
          <Card>
            <ThemedText>{move.flavorText}</ThemedText>
          </Card>
        </Section>
      ) : null}

      <Section title={t('move.battle')}>
        <Card>
          {stats ? (
            <InfoRow
              label={t('move.target')}
              value={stats.target.description ?? stats.target.name}
            />
          ) : null}
          {stats?.effectChance !== null && stats?.effectChance !== undefined ? (
            <InfoRow label={t('move.effectChance')} value={`${stats.effectChance}%`} />
          ) : null}
          <InfoRow
            label={t('move.introduced')}
            value={t('common.generation', { number: move.generationId })}
          />
          {move.machine ? (
            <LinkRow
              title={move.machine.label}
              subtitle={t('move.machine')}
              leading={<ItemIcon itemId={move.machine.itemId} size={28} />}
              onPress={() => openItem(move.machine!.itemId)}
              color={accent.text}
            />
          ) : null}
          {meta.map((line) => (
            <ThemedText key={line} variant="small">
              • {line}
            </ThemedText>
          ))}
        </Card>
      </Section>

      {move.flags.length > 0 ? (
        <Section title={t('move.properties')}>
          <Card>
            {move.flags.map((flag) => (
              <View key={flag.identifier} style={styles.flag}>
                <ThemedText bold variant="small">
                  {flag.name}
                </ThemedText>
                {flag.description ? (
                  <ThemedText variant="caption" muted>
                    {flag.description}
                  </ThemedText>
                ) : null}
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      {move.zMove ? (
        <Section title={t('move.zMove')}>
          <Card>
            {move.zMove.power !== null ? (
              <InfoRow label={t('move.zPower')} value={move.zMove.power} />
            ) : null}
            {move.zMove.effect ? (
              <InfoRow
                label={t('move.zEffect')}
                value={
                  isZEffect(move.zMove.effect)
                    ? t(`move.zEffects.${move.zMove.effect}`)
                    : move.zMove.effect
                }
              />
            ) : null}
            {describeZBoosts(move.zMove.boosts, statName) ? (
              <InfoRow
                label={t('move.zBoosts')}
                value={describeZBoosts(move.zMove.boosts, statName)!}
              />
            ) : null}
            {move.zMove.move ? (
              <LinkRow
                title={move.zMove.move.name}
                subtitle={
                  move.zMove.crystal ? `${t('move.crystal')}: ${move.zMove.crystal.name}` : null
                }
                leading={
                  move.zMove.crystal ? <ItemIcon itemId={move.zMove.crystal.id} size={28} /> : null
                }
                onPress={() => openMove(move.zMove!.move!.id)}
                color={accent.text}
              />
            ) : null}
            {move.zMove.signatures.length > 0 ? (
              <ThemedText variant="caption" bold muted style={styles.subheading}>
                {t('move.signatures')}
              </ThemedText>
            ) : null}
            {move.zMove.signatures.map((signature, index) => (
              <LinkRow
                key={`${signature.move.id}-${signature.pokemon?.id ?? index}`}
                title={signature.move.name}
                subtitle={[signature.pokemon?.name, signature.crystal?.name]
                  .filter(Boolean)
                  .join(' · ')}
                leading={
                  signature.crystal ? <ItemIcon itemId={signature.crystal.id} size={28} /> : null
                }
                onPress={() => openMove(signature.move.id)}
                color={accent.text}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      {move.maxMove ? (
        <Section title={t('move.maxMove')}>
          <Card>
            {move.maxMove.power !== null ? (
              <InfoRow label={t('move.maxPower')} value={move.maxMove.power} />
            ) : null}
            {move.maxMove.move ? (
              <LinkRow
                title={move.maxMove.move.name}
                onPress={() => openMove(move.maxMove!.move!.id)}
                color={accent.text}
              />
            ) : null}
            {move.maxMove.gmax.length > 0 ? (
              <>
                <ThemedText variant="caption" bold muted style={styles.subheading}>
                  {t('move.gmax')}
                </ThemedText>
                <ThemedText variant="caption" muted>
                  {t('move.gmaxNote')}
                </ThemedText>
              </>
            ) : null}
            {move.maxMove.gmax.map((gmax) =>
              gmax.pokemon ? (
                <LinkRow
                  key={gmax.psId}
                  title={gmax.name}
                  subtitle={[
                    gmax.pokemon.name,
                    gmax.power !== null ? t('move.fixedPower', { power: gmax.power }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  onPress={() => openPokemon(gmax.pokemon!.id)}
                  color={accent.text}
                />
              ) : (
                <ThemedText key={gmax.psId} bold>
                  {gmax.name}
                </ThemedText>
              ),
            )}
          </Card>
        </Section>
      ) : null}

      {move.variantOf.length > 0 ? (
        <Section title={t('move.variantOf.title')}>
          <Card>
            {move.variantOf.map((source, index) => (
              <View key={index} style={styles.flag}>
                <ThemedText bold variant="small">
                  {source.kind === 'z_signature' && source.baseMove
                    ? t('move.variantOf.zSignature', { move: source.baseMove.name })
                    : source.kind === 'z'
                      ? t('move.variantOf.z', { type: typeName(source.type ?? '') })
                      : source.type === 'normal' && stats?.damageClass === 'status'
                        ? t('move.variantOf.maxGuard')
                        : t('move.variantOf.max', { type: typeName(source.type ?? '') })}
                </ThemedText>
                {source.crystal ? (
                  <LinkRow
                    title={t('move.variantOf.holding', { item: source.crystal.name })}
                    leading={<ItemIcon itemId={source.crystal.id} size={28} />}
                    onPress={() => openItem(source.crystal!.id)}
                  />
                ) : null}
                {source.pokemon ? (
                  <LinkRow
                    title={t('move.variantOf.pokemon', { name: source.pokemon.name })}
                    onPress={() => openPokemon(source.pokemon!.id)}
                  />
                ) : null}
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      {move.zMove || move.maxMove || move.variantKind ? (
        <ThemedText variant="caption" muted>
          {t('move.mechanicNote')}
        </ThemedText>
      ) : null}
      {!move.inGame ? (
        <ThemedText variant="caption" muted>
          {t('move.notInGame', { game: game.name })}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flag: { gap: 2, paddingVertical: SPACING.xs },
  subheading: { marginTop: SPACING.sm, textTransform: 'uppercase' },
});
