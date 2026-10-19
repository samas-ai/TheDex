import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  FAVORITE_ENTITY_TYPES,
  listFavoriteEntries,
  type FavoriteEntityType,
  type FavoriteEntry,
} from '@thedex/db';
import { SPACING } from '@thedex/ui-tokens';
import { useFavoritesVersion } from '../../entities/favorite/favorites-store';
import { ItemIcon } from '../../entities/item/ItemIcon';
import { PokemonSprite } from '../../entities/pokemon/PokemonSprite';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useUserDataVersion } from '../../shared/db/user-data-events';
import { entityHref } from '../../shared/entity-href';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Icon, type IconName } from '../../shared/ui/Icon';
import { LinkRow } from '../../shared/ui/LinkRow';
import { Button, Card, Loading, Message, Section } from '../../shared/ui/primitives';

/** Same glyphs as the tabs and the More screen. */
const TYPE_ICONS: Readonly<Record<Exclude<FavoriteEntityType, 'pokemon' | 'item'>, IconName>> = {
  move: 'sword-cross',
  ability: 'star-four-points',
  location: 'map-marker-radius',
};

/** Pixel sprites, like every other list. */
const ROW_SPRITE_STYLE = 'pixel';
const LEADING_SIZE = 40;

/** Everything the user starred (RNF06), by entity type; tapping opens the entry. */
export function FavoritesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx } = useGame();
  const userData = useUserDataVersion();
  const favorites = useFavoritesVersion();
  const entries = useAsync(
    () => listFavoriteEntries(db, ctx.langChain),
    [db, ctx.langChain, userData, favorites],
  );

  const glyph = (entry: FavoriteEntry) => {
    switch (entry.entityType) {
      case 'pokemon':
        return (
          <PokemonSprite pokemonId={entry.entityId} style={ROW_SPRITE_STYLE} size={LEADING_SIZE} />
        );
      case 'item':
        return <ItemIcon itemId={entry.entityId} size={32} />;
      default:
        return <Icon name={TYPE_ICONS[entry.entityType]} color={theme.colors.primary} />;
    }
  };
  // Same width for every glyph, so the names line up.
  const leading = (entry: FavoriteEntry) => <View style={styles.leading}>{glyph(entry)}</View>;

  const body = () => {
    if (entries.error) {
      return (
        <Message
          text={t('common.error', { message: entries.error.message })}
          action={<Button label={t('common.retry')} onPress={entries.reload} />}
        />
      );
    }
    if (!entries.data) return <Loading />;
    if (entries.data.length === 0) return <Message text={t('favorites.empty')} />;
    return FAVORITE_ENTITY_TYPES.map((entityType) => {
      const ofType = entries.data!.filter((entry) => entry.entityType === entityType);
      if (ofType.length === 0) return null;
      return (
        <Section key={entityType} title={t(`more.entityTypes.${entityType}`)}>
          <Card>
            {ofType.map((entry) => (
              <LinkRow
                key={entry.entityId}
                title={entry.name}
                leading={leading(entry)}
                onPress={() => router.push(entityHref(entry.entityType, entry.entityId))}
              />
            ))}
          </Card>
        </Section>
      );
    });
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Stack.Screen options={{ title: t('nav.favorites') }} />
      {body()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  leading: {
    width: LEADING_SIZE,
    height: LEADING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
