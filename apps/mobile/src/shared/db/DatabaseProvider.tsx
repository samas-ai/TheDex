import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { openAppDatabase, type AppDatabase } from './bootstrap';

const DatabaseContext = createContext<AppDatabase | null>(null);

/** Opens the databases once and renders children only when they are ready. */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [database, setDatabase] = useState<AppDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    openAppDatabase()
      .then(setDatabase)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text>Database error: {error}</Text>
      </View>
    );
  }
  if (!database) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  return <DatabaseContext.Provider value={database}>{children}</DatabaseContext.Provider>;
}

export function useAppDatabase(): AppDatabase {
  const database = useContext(DatabaseContext);
  if (!database) throw new Error('useAppDatabase must be used inside <DatabaseProvider>');
  return database;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
