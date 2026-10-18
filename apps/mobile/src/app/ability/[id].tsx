import { useLocalSearchParams } from 'expo-router';
import { AbilityDetailScreen } from '../../features/ability-detail/AbilityDetailScreen';

export default function AbilityRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AbilityDetailScreen abilityId={Number(id)} />;
}
