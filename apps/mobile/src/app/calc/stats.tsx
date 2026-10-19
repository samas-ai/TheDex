import { useLocalSearchParams } from 'expo-router';
import { StatCalcScreen } from '../../features/calculators/StatCalcScreen';

export default function StatCalcRoute() {
  const { pokemon } = useLocalSearchParams<{ pokemon?: string }>();
  return <StatCalcScreen initialPokemonId={pokemon ? Number(pokemon) : null} />;
}
