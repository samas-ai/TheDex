import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { FavoriteEntityType } from '@thedex/db';
import { Icon, type IconColor } from '../../shared/ui/Icon';
import { useFavorite } from './favorites-store';

/** Header star that favorites a Pokémon, move, ability, item or location (RNF06). */
export function FavoriteButton({
  entityType,
  entityId,
  color,
}: {
  entityType: FavoriteEntityType;
  entityId: number;
  /** The header tint (defaults to the theme text color). */
  color?: IconColor;
}) {
  const { t } = useTranslation();
  const { favorite, toggle } = useFavorite(entityType, entityId);
  return (
    <Pressable
      onPress={toggle}
      disabled={favorite === undefined}
      accessibilityRole="button"
      accessibilityLabel={favorite ? t('favorites.remove') : t('favorites.add')}
      accessibilityState={{ selected: favorite === true }}
      hitSlop={8}
    >
      <Icon name={favorite ? 'star' : 'star-outline'} color={color} />
    </Pressable>
  );
}
