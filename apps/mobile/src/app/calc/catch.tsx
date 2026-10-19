import { useLocalSearchParams } from 'expo-router';
import { CatchCalcScreen } from '../../features/calculators/CatchCalcScreen';

export default function CatchCalcRoute() {
  const { pokemon } = useLocalSearchParams<{ pokemon?: string }>();
  return <CatchCalcScreen initialPokemonId={pokemon ? Number(pokemon) : null} />;
}
