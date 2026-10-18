import { useLocalSearchParams } from 'expo-router';
import { ProfileScreen } from '../../features/pokemon-profile/ProfileScreen';

export default function PokemonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProfileScreen pokemonId={Number(id)} />;
}
