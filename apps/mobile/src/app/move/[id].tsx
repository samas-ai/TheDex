import { useLocalSearchParams } from 'expo-router';
import { MoveDetailScreen } from '../../features/move-detail/MoveDetailScreen';

export default function MoveRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MoveDetailScreen moveId={Number(id)} />;
}
