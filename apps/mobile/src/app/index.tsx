import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAppDatabase } from '../shared/db/DatabaseProvider';

/** Phase 1 placeholder — the Pokédex UI arrives in Phase 2. */
export default function Home() {
  const { dataVersion } = useAppDatabase();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'TheDex' }} />
      <Text style={styles.title}>TheDex</Text>
      <Text>Game data {dataVersion}</Text>
      <Link href="/diagnostics" style={styles.link}>
        Open diagnostics
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  link: { fontSize: 16, textDecorationLine: 'underline', marginTop: 12 },
});
