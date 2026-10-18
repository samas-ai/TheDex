import { useLocalSearchParams } from 'expo-router';
import { LocationDetailScreen } from '../../features/location-detail/LocationDetailScreen';

export default function LocationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LocationDetailScreen locationId={Number(id)} />;
}
