import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getItemDetail, type BerryInfo, type ItemDetail } from '@thedex/db';
import { SPACING } from '@thedex/ui-tokens';
import { useCatalog } from '../../entities/catalog/CatalogProvider';
import { ItemIcon } from '../../entities/item/ItemIcon';
import { PokemonSprite } from '../../entities/pokemon/PokemonSprite';
import { TypeBadge } from '../../entities/pokemon/TypeBadge';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { formatPrice, sellPrice } from '../../shared/format';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { useTypeAccent } from '../../shared/theme/useTypeAccent';
import { LinkRow } from '../../shared/ui/LinkRow';
import {
  Button,
  Card,
  InfoRow,
  Loading,
  Message,
  Section,
  ThemedText,
} from '../../shared/ui/primitives';

const SPRITE_STYLE = 'pixel';

/** RF05.2: icon, effect, prices, Fling, berry data, what the item teaches or evolves. */
export function ItemDetailScreen({ itemId }: { itemId: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const { typeName } = useCatalog();
  const detail = useAsync(() => getItemDetail(db, itemId, ctx), [db, ctx, itemId]);
  const item = detail.data && detail.data.id === itemId ? detail.data : null;
  const accent = useTypeAccent(item?.machine?.move.type);

  if (detail.error) {
    return (
      <Message
        text={t('common.error', { message: detail.error.message })}
        action={<Button label={t('common.retry')} onPress={detail.reload} />}
      />
    );
  }
  if (!item) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: '' }} />
        {detail.loading ? <Loading /> : <Message text={t('item.notFound')} />}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: item.name }} />
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: theme.colors.surface }]}>
          <ItemIcon itemId={item.id} size={56} />
        </View>
        <View style={styles.headerText}>
          <ThemedText variant="headline">{item.name}</ThemedText>
          <ThemedText muted>{t(`itemDex.groups.${item.group}`)}</ThemedText>
          <ThemedText variant="caption" muted>
            {`${item.category.name} · ${item.pocket.name}`}
          </ThemedText>
        </View>
      </View>
      {!item.inGame ? (
        <ThemedText variant="caption" muted style={styles.note}>
          {t('item.notInGame')}
        </ThemedText>
      ) : null}

      {item.machine ? (
        <Section title={t('item.teaches')}>
          <Card>
            <LinkRow
              title={item.machine.move.name}
              subtitle={item.machine.label}
              leading={
                item.machine.move.type ? (
                  <TypeBadge
                    type={item.machine.move.type}
                    name={typeName(item.machine.move.type)}
                    size="sm"
                  />
                ) : null
              }
              onPress={() => router.push(`/move/${item.machine!.move.id}`)}
              color={accent.text}
            />
          </Card>
        </Section>
      ) : null}

      {item.effect || item.shortEffect ? (
        <Section title={t('item.effect')}>
          <Card>
            <ThemedText>{item.effect ?? item.shortEffect}</ThemedText>
          </Card>
        </Section>
      ) : null}

      {item.flavorText ? (
        <Section title={t('item.inGame')}>
          <Card>
            <ThemedText>{item.flavorText}</ThemedText>
          </Card>
        </Section>
      ) : null}

      <ItemFacts item={item} />
      {item.berry ? <BerrySection berry={item.berry} /> : null}
      <ItemUses item={item} />

      <Section title={t('item.locations')}>
        <Card>
          {item.locations.length === 0 ? (
            <ThemedText muted variant="small">
              {t('item.locationsGap')}
            </ThemedText>
          ) : (
            item.locations.map((location, index) =>
              location.locationId !== null ? (
                <LinkRow
                  key={index}
                  title={location.name ?? ''}
                  subtitle={location.notes}
                  onPress={() => router.push(`/location/${location.locationId}`)}
                />
              ) : (
                <ThemedText key={index}>{location.notes}</ThemedText>
              ),
            )
          )}
        </Card>
      </Section>
    </ScrollView>
  );
}

function ItemFacts({ item }: { item: ItemDetail }) {
  const { t, i18n } = useTranslation();
  const sell = sellPrice(item.cost);
  return (
    <>
      <Section title={t('item.prices')}>
        <Card>
          <InfoRow
            label={t('item.buy')}
            value={item.cost ? formatPrice(item.cost, i18n.language) : t('item.notSold')}
          />
          <InfoRow
            label={t('item.sell')}
            value={sell !== null ? formatPrice(sell, i18n.language) : '—'}
          />
        </Card>
      </Section>
      {item.flingPower !== null || item.flingEffect ? (
        <Section title={t('item.fling')}>
          <Card>
            {item.flingPower !== null ? (
              <InfoRow label={t('item.flingPower')} value={item.flingPower} />
            ) : null}
            {item.flingEffect ? (
              <InfoRow label={t('item.flingEffect')} value={item.flingEffect} />
            ) : null}
          </Card>
        </Section>
      ) : null}
      {item.flags.length > 0 ? (
        <Section title={t('item.properties')}>
          <Card>
            {item.flags.map((flag) => (
              <ThemedText key={flag.identifier} variant="small">
                • {flag.description}
              </ThemedText>
            ))}
          </Card>
        </Section>
      ) : null}
    </>
  );
}

function BerrySection({ berry }: { berry: BerryInfo }) {
  const { t } = useTranslation();
  const { typeName } = useCatalog();
  return (
    <Section title={t('item.berry')}>
      <Card>
        {berry.firmness ? <InfoRow label={t('item.firmness')} value={berry.firmness.name} /> : null}
        {berry.naturalGiftType ? (
          <InfoRow
            label={t('item.naturalGift')}
            value={
              <View style={styles.inline}>
                <TypeBadge
                  type={berry.naturalGiftType}
                  name={typeName(berry.naturalGiftType)}
                  size="sm"
                />
                {berry.naturalGiftPower !== null ? (
                  <ThemedText>{berry.naturalGiftPower}</ThemedText>
                ) : null}
              </View>
            }
          />
        ) : null}
        {berry.size !== null ? (
          <InfoRow label={t('item.size')} value={t('item.sizeValue', { value: berry.size })} />
        ) : null}
        {berry.growthTime !== null ? (
          <InfoRow
            label={t('item.growth')}
            value={t('item.growthValue', { hours: berry.growthTime })}
          />
        ) : null}
        {berry.maxHarvest !== null ? (
          <InfoRow label={t('item.harvest')} value={berry.maxHarvest} />
        ) : null}
        {berry.smoothness !== null ? (
          <InfoRow label={t('item.smoothness')} value={berry.smoothness} />
        ) : null}
        {berry.flavors.length > 0 ? (
          <InfoRow
            label={t('item.flavors')}
            value={berry.flavors
              .map((flavor) => `${flavor.flavor.name} ${flavor.potency}`)
              .join(', ')}
          />
        ) : null}
      </Card>
    </Section>
  );
}

/** What the item does to Pokémon: evolutions, form changes, Z-Moves. */
function ItemUses({ item }: { item: ItemDetail }) {
  const { t } = useTranslation();
  const openPokemon = (id: number) => router.push(`/pokemon/${id}`);
  const sprite = (pokemonId: number) => (
    <PokemonSprite pokemonId={pokemonId} style={SPRITE_STYLE} size={40} />
  );
  return (
    <>
      {item.evolutions.length > 0 ? (
        <Section title={t('item.evolutions')}>
          <Card>
            {item.evolutions.map((evolution) => (
              <LinkRow
                key={evolution.pokemonId}
                title={evolution.name}
                subtitle={evolution.held ? t('item.evolveHold') : t('item.evolveUse')}
                leading={sprite(evolution.pokemonId)}
                onPress={() => openPokemon(evolution.pokemonId)}
              />
            ))}
          </Card>
        </Section>
      ) : null}
      {item.formChanges.length > 0 ? (
        <Section title={t('item.formChanges')}>
          <Card>
            {item.formChanges.map((change) => (
              <LinkRow
                key={change.pokemonId}
                title={change.name}
                subtitle={t('item.formFrom', { name: change.from.name })}
                leading={sprite(change.pokemonId)}
                onPress={() => openPokemon(change.pokemonId)}
              />
            ))}
          </Card>
        </Section>
      ) : null}
      {item.zMoves.length > 0 ? (
        <Section title={t('item.zMoves')}>
          <Card>
            {item.zMoves.map((move) => (
              <LinkRow
                key={move.id}
                title={move.name}
                onPress={() => router.push(`/move/${move.id}`)}
              />
            ))}
          </Card>
        </Section>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginBottom: SPACING.lg },
  iconBox: { padding: SPACING.md, borderRadius: 16 },
  headerText: { flex: 1, gap: 2 },
  note: { marginBottom: SPACING.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
});
