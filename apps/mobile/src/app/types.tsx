import { useLocalSearchParams } from 'expo-router';
import { TypeDexScreen } from '../features/type-dex/TypeDexScreen';

export default function TypesRoute() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  return <TypeDexScreen initialTypeId={type ? Number(type) : undefined} />;
}
