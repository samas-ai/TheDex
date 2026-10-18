import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Stack } from 'expo-router';
import { getDataMeta, getTableCounts, searchQuery, type SearchHit } from '@thedex/db';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { ThemedText as Text } from '../../shared/ui/primitives';

const COUNTED_TABLES = [
  'pokemon_species',
  'pokemon',
  'moves',
  'pokemon_moves',
  'encounters',
  'search_terms',
  'checklist_entries',
];

const LANG_CHAINS: Record<string, readonly string[]> = {
  en: ['en'],
  'pt-BR': ['pt-BR', 'en'],
  ja: ['ja-Hrkt', 'ja', 'en'],
};

/**
 * Developer diagnostics (no design): verifies the offline databases on a real device and
 * measures search latency against the RNF07 budget (< 100 ms).
 */
export default function Diagnostics() {
  const { db, dataVersion, installedNow } = useAppDatabase();
  const theme = useTheme();
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('char');
  const [lang, setLang] = useState<keyof typeof LANG_CHAINS>('en');
  const [hits, setHits] = useState<readonly SearchHit[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    void getDataMeta(db).then(setMeta);
    void getTableCounts(db, COUNTED_TABLES).then(setCounts);
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    void searchQuery(
      db,
      query,
      { langChain: LANG_CHAINS[lang] ?? ['en'] },
      { limitPerType: 5 },
    ).then((result) => {
      if (cancelled) return;
      setElapsedMs(performance.now() - started);
      setHits(result.hits);
    });
    return () => {
      cancelled = true;
    };
  }, [db, query, lang]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Diagnostics' }} />
      <Text style={styles.mono}>
        data_version {dataVersion}
        {installedNow ? ' (installed this launch)' : ''}
      </Text>
      <Text style={styles.mono}>
        PokeAPI {meta.source_pokeapi_sha?.slice(0, 7)} · @pkmn/dex {meta.source_pkmn_version} ·
        built {meta.built_at?.slice(0, 10)}
      </Text>
      <Text style={styles.mono}>
        {Object.entries(counts)
          .map(([table, n]) => `${table}: ${n}`)
          .join('\n')}
      </Text>

      <View style={styles.row}>
        {Object.keys(LANG_CHAINS).map((key) => (
          <Pressable
            key={key}
            onPress={() => setLang(key)}
            style={[styles.chip, { borderColor: theme.colors.border }]}
          >
            <Text style={key === lang ? styles.bold : undefined}>{key}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Search…"
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, { borderColor: theme.colors.border, color: theme.colors.text }]}
      />
      <Text
        color={elapsedMs !== null && elapsedMs >= 100 ? theme.colors.danger : theme.colors.success}
      >
        {elapsedMs === null ? '…' : `${elapsedMs.toFixed(1)} ms · ${hits.length} hits`}
      </Text>
      <FlatList
        data={hits}
        keyExtractor={(hit) => `${hit.entityType}:${hit.entityId}`}
        renderItem={({ item }) => (
          <Text>
            [{item.entityType}] {item.name}
            {item.matched !== item.name ? `  (${item.matched})` : ''}
          </Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  row: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  bold: { fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
});
