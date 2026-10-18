import { useLocalSearchParams } from 'expo-router';
import { ItemDetailScreen } from '../../features/item-detail/ItemDetailScreen';

export default function ItemRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ItemDetailScreen itemId={Number(id)} />;
}
